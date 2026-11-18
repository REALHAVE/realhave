-- =====================================================================
-- 리얼해브 DB 9 : PASS 본인인증 → 이메일 인증으로 변경 (2026-11-18 결정)
--  - 가입 시 이메일 6자리 코드 확인 (Supabase Auth "Confirm email")
--  - 휴대폰번호는 필수 입력이지만 진위 확인은 하지 않음
--  - CI(중복가입 방지값)는 PASS가 없으므로 저장하지 않음
-- 이미 setup-all.sql 을 실행한 프로젝트에서 이 파일만 1번 실행하세요.
-- =====================================================================

-- 1) 휴대폰번호: 숫자만 저장, 국내 휴대폰 형식(010·011·016·017·018·019)만 허용
alter table public.user_private
  add constraint user_private_phone_format
  check (phone is null or phone ~ '^01[016789][0-9]{7,8}$');

comment on column public.user_private.phone is
  '가입 시 본인이 입력한 휴대폰번호 (숫자만, 진위 미확인). 본인·관리자(master·cs)만 조회';

-- 2) PASS 전용 컬럼 제거
alter table public.user_private drop column if exists ci_hash;

-- 3) "활동 가능한 회원" 기준 변경
--    로그인 + 정상 상태 + 이메일 확인 완료 + 휴대폰번호 입력
--    (identity_verified_at 대신 Supabase가 기록하는 email_confirmed_at 사용)
create or replace function private.is_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.profiles p
    join public.user_private u on u.user_id = p.id
    join auth.users au         on au.id     = p.id
    where p.id = auth.uid()
      and p.status = 'active'
      and au.email_confirmed_at is not null
      and u.phone is not null
  );
$$;

alter table public.user_private drop column if exists identity_verified_at;

-- 4) 가입 시 자동 생성: 휴대폰번호도 함께 저장
--    (하이픈·공백은 지우고 숫자만. 형식이 틀리면 저장하지 않음 → 활동 불가 상태로 남음)
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  nick  text := nullif(btrim(new.raw_user_meta_data ->> 'nickname'), '');
  phone text := regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', ''), '[^0-9]', '', 'g');
begin
  insert into public.profiles (id, nickname)
  values (new.id, coalesce(nick, 'user_' || left(replace(new.id::text, '-', ''), 8)));

  insert into public.user_private (user_id, phone, terms_agreed_at, privacy_agreed_at)
  values (
    new.id,
    case when phone ~ '^01[016789][0-9]{7,8}$' then phone end,
    case when new.raw_user_meta_data ->> 'agreed_terms'   = 'true' then now() end,
    case when new.raw_user_meta_data ->> 'agreed_privacy' = 'true' then now() end
  );
  return new;
end $$;

-- 5) 닉네임 사용 가능 여부 확인 (가입 화면에서 사용, 비회원도 호출 가능)
create or replace function public.is_nickname_available(p_nickname text)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.profiles where lower(nickname) = lower(btrim(p_nickname))
  );
$$;
revoke all on function public.is_nickname_available(text) from public;
grant execute on function public.is_nickname_available(text) to anon, authenticated;
