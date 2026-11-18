-- =====================================================================
-- 리얼해브 DB 1/8 : 기본 설정 · 공통 함수 · 회원 · 관리자
-- =====================================================================

-- 내부용 함수 보관 스키마 (API로 노출되지 않음)
create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

create type public.user_status as enum ('active', 'suspended');
create type public.admin_role  as enum ('master', 'product', 'cs');

-- updated_at 자동 갱신
create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- "신뢰할 수 있는 실행"인지 판단
--  - SQL Editor / 서버(service_role) 실행, 또는 내부 함수가 잠깐 켠 플래그
--  - 앱 사용자(anon/authenticated)의 직접 요청은 false
create or replace function private.is_trusted()
returns boolean language sql stable set search_path = '' as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '')
           not in ('anon', 'authenticated')
      or coalesce(current_setting('realhave.trusted', true), '') = 'on';
$$;

-- 내부 함수가 보호 컬럼을 바꿀 때 잠깐 켜고 끄는 스위치
create or replace function private.trusted_on()
returns void language sql set search_path = '' as $$
  select set_config('realhave.trusted', 'on', true);
$$;
create or replace function private.trusted_off()
returns void language sql set search_path = '' as $$
  select set_config('realhave.trusted', '', true);
$$;

-- 문자열을 uuid로 (형식이 틀리면 null)
create or replace function private.to_uuid(t text)
returns uuid language sql immutable set search_path = '' as $$
  select case
    when t ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then t::uuid
  end;
$$;

-- ---------------------------------------------------------------------
-- 회원
-- ---------------------------------------------------------------------

-- 공개 정보 (누구나 조회)
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nickname    text not null unique check (char_length(nickname) between 2 and 20),
  avatar_path text,
  status      public.user_status not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 비공개 정보 (본인 · 관리자만)
create table public.user_private (
  user_id              uuid primary key references public.profiles (id) on delete cascade,
  phone                text,            -- PASS 본인인증으로 확인된 번호 (서버만 기록)
  identity_verified_at timestamptz,     -- 본인인증 완료 시각. 없으면 글쓰기·채팅·찜 불가
  ci_hash              text unique,     -- 중복가입 방지용 (저장 여부 확정 대기)
  terms_agreed_at      timestamptz,
  privacy_agreed_at    timestamptz,
  suspended_reason     text,            -- 자격중지 사유 (관리자 기록)
  updated_at           timestamptz not null default now()
);

-- 관리자
create table public.admins (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  role       public.admin_role not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create trigger profiles_updated_at     before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger user_private_updated_at before update on public.user_private
  for each row execute function private.set_updated_at();

-- 관리자 여부 (master는 모든 권한 통과)
create or replace function private.is_admin(required public.admin_role default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admins a
    where a.user_id = auth.uid()
      and (required is null or a.role = 'master' or a.role = required)
  );
$$;

-- 활동 가능한 회원인지 (로그인 + 정상 상태 + 본인인증 완료)
create or replace function private.is_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.profiles p
    join public.user_private u on u.user_id = p.id
    where p.id = auth.uid()
      and p.status = 'active'
      and u.identity_verified_at is not null
  );
$$;

-- 가입 시 profiles / user_private 자동 생성
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  nick text := nullif(btrim(new.raw_user_meta_data ->> 'nickname'), '');
begin
  insert into public.profiles (id, nickname)
  values (new.id, coalesce(nick, 'user_' || left(replace(new.id::text, '-', ''), 8)));

  insert into public.user_private (user_id, terms_agreed_at, privacy_agreed_at)
  values (
    new.id,
    case when new.raw_user_meta_data ->> 'agreed_terms'   = 'true' then now() end,
    case when new.raw_user_meta_data ->> 'agreed_privacy' = 'true' then now() end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- 회원 정보 수정 보호
--  - 본인: 닉네임·사진만
--  - 관리자(master): 다른 회원의 상태(정상/자격중지)만
create or replace function private.guard_profiles()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.is_trusted() then return new; end if;

  if new.id <> old.id or new.created_at <> old.created_at then
    raise exception '변경할 수 없는 항목입니다';
  end if;

  if old.id = auth.uid() then
    if new.status <> old.status then
      raise exception '회원 상태는 관리자만 변경할 수 있습니다';
    end if;
  else
    -- 관리자가 다른 회원을 수정하는 경우
    if new.nickname <> old.nickname or new.avatar_path is distinct from old.avatar_path then
      raise exception '관리자는 회원 상태만 변경할 수 있습니다';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function private.guard_profiles();
