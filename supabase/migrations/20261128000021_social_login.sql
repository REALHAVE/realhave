-- =====================================================================
-- 리얼해브 DB 21 : 소셜 로그인 (12단계)
--  1) 가입 시 닉네임이 이미 있으면 뒤에 숫자를 붙여 겹치지 않게
--     (소셜 계정 이름이 기존 닉네임과 같으면 가입 자체가 실패하던 문제)
--  2) 소셜로 처음 가입한 회원의 추가 정보 입력 (닉네임·휴대폰번호·약관 동의)
--     — 결정 7(휴대폰 필수)을 소셜 가입에도 똑같이 적용
-- 이 파일을 Supabase SQL Editor에서 1번 실행하세요.
-- =====================================================================

-- 1) 가입 시 프로필 자동 생성 (닉네임 중복 방지)
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta  jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  base  text;
  nick  text;
  phone text := regexp_replace(coalesce(meta ->> 'phone', ''), '[^0-9]', '', 'g');
  tries int := 0;
begin
  -- 이메일 가입은 nickname, 소셜은 이름(name/full_name/user_name) 순서로 사용
  base := nullif(btrim(coalesce(meta ->> 'nickname', meta ->> 'name', meta ->> 'full_name',
                                meta ->> 'user_name', '')), '');
  if base is null or char_length(base) < 2 then
    base := 'user_' || left(replace(new.id::text, '-', ''), 8);
  end if;
  base := left(base, 15);
  nick := base;
  while exists (select 1 from public.profiles where lower(nickname) = lower(nick)) and tries < 20 loop
    tries := tries + 1;
    nick := base || '_' || (floor(random() * 9000) + 1000)::int;
  end loop;

  insert into public.profiles (id, nickname) values (new.id, nick);

  insert into public.user_private (user_id, phone, terms_agreed_at, privacy_agreed_at)
  values (
    new.id,
    case when phone ~ '^01[016789][0-9]{7,8}$' then phone end,
    case when meta ->> 'agreed_terms'   = 'true' then now() end,
    case when meta ->> 'agreed_privacy' = 'true' then now() end
  );
  return new;
end $$;

-- 2) 추가 정보가 필요한지 (휴대폰번호 또는 약관 동의가 비어 있으면 필요)
create or replace function public.my_profile_status()
returns table (needs_onboarding boolean, nickname text, phone text)
language sql stable security definer set search_path = '' as $$
  select (up.phone is null or up.terms_agreed_at is null or up.privacy_agreed_at is null),
         p.nickname, up.phone
  from public.profiles p
  left join public.user_private up on up.user_id = p.id
  where p.id = auth.uid();
$$;

-- 추가 정보 저장 (본인만)
create or replace function public.complete_profile(p_nickname text, p_phone text, p_agree boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid   uuid := auth.uid();
  nick  text := btrim(coalesce(p_nickname, ''));
  digits text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
begin
  if uid is null then
    raise exception '로그인이 필요합니다';
  end if;
  if char_length(nick) < 2 or char_length(nick) > 20 then
    raise exception '닉네임은 2~20자로 입력해주세요';
  end if;
  if exists (select 1 from public.profiles where lower(nickname) = lower(nick) and id <> uid) then
    raise exception '이미 사용 중인 닉네임이에요';
  end if;
  if digits !~ '^01[016789][0-9]{7,8}$' then
    raise exception '휴대폰번호를 확인해주세요 (예: 010-1234-5678)';
  end if;
  if not coalesce(p_agree, false) then
    raise exception '이용약관 및 개인정보처리방침에 동의해주세요';
  end if;

  perform private.trusted_on();
  update public.profiles set nickname = nick where id = uid;
  update public.user_private
     set phone = digits,
         terms_agreed_at   = coalesce(terms_agreed_at, now()),
         privacy_agreed_at = coalesce(privacy_agreed_at, now())
   where user_id = uid;
  perform private.trusted_off();
end $$;

revoke all on function public.my_profile_status()                    from public, anon;
revoke all on function public.complete_profile(text, text, boolean)  from public, anon;
grant execute on function public.my_profile_status()                   to authenticated;
grant execute on function public.complete_profile(text, text, boolean) to authenticated;
