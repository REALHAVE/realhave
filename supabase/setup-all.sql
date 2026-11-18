-- =====================================================================
-- 리얼해브 Supabase 초기 설정 (한 번에 실행용)
-- 이 파일은 migrations 폴더 1~8번 + seed.sql + 9번(이메일 인증 전환)을 순서대로 합친 것입니다.
-- 새 Supabase 프로젝트에서 딱 1번만 실행하세요. (두 번 실행하면 '이미 있음' 오류)
-- =====================================================================


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


-- =====================================================================
-- 리얼해브 DB 2/8 : 기준 데이터 (카테고리 · 브랜드 · 구매처 · 거래방식 · 색상)
-- =====================================================================

create type public.size_type    as enum ('none', 'clothing', 'shoes', 'kids');
create type public.place_region as enum ('domestic', 'overseas');

-- 카테고리 (대분류 / 소분류 2단계)
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid references public.categories (id) on delete restrict,
  name       text not null check (char_length(name) between 1 and 30),
  size_type  public.size_type not null default 'none',  -- 소분류는 대분류 값을 자동으로 따라감
  sort_order int  not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique nulls not distinct (parent_id, name)
);
create index categories_parent_idx on public.categories (parent_id, sort_order);

-- 소분류: 2단계까지만, 사이즈 규칙은 대분류 상속
create or replace function private.categories_inherit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  parent record;
begin
  if new.parent_id is not null then
    select c.parent_id, c.size_type into parent
    from public.categories c where c.id = new.parent_id;
    if not found then
      raise exception '상위 카테고리가 없습니다';
    end if;
    if parent.parent_id is not null then
      raise exception '카테고리는 대분류/소분류 2단계까지만 만들 수 있습니다';
    end if;
    new.size_type := parent.size_type;
  end if;
  return new;
end $$;

create trigger categories_inherit before insert or update on public.categories
  for each row execute function private.categories_inherit();

-- 대분류 사이즈 규칙이 바뀌면 소분류에도 반영
create or replace function private.categories_cascade_size()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.parent_id is null and new.size_type <> old.size_type then
    update public.categories set size_type = new.size_type where parent_id = new.id;
  end if;
  return new;
end $$;

create trigger categories_cascade_size after update on public.categories
  for each row execute function private.categories_cascade_size();

-- 브랜드
create table public.brands (
  id             uuid primary key default gen_random_uuid(),
  name_en        text not null unique check (char_length(name_en) between 1 and 50),
  name_ko        text,
  origin_country text,
  index_letter   char(1) not null check (index_letter ~ '^[A-Z#]$'),
  logo_path      text,
  is_popular     boolean not null default false,
  popular_order  int,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);
create index brands_index_letter_idx on public.brands (index_letter, name_en);

-- A-Z 인덱스 글자 자동 지정 (영문이 아니면 '#')
create or replace function private.brands_index_letter()
returns trigger language plpgsql set search_path = '' as $$
declare
  first_char text := upper(left(btrim(new.name_en), 1));
begin
  if new.index_letter is null or tg_op = 'INSERT' or new.name_en <> old.name_en then
    new.index_letter := case when first_char ~ '^[A-Z]$' then first_char else '#' end;
  end if;
  return new;
end $$;

create trigger brands_index_letter before insert or update on public.brands
  for each row execute function private.brands_index_letter();

-- 구매처
create table public.purchase_places (
  code       text primary key,
  region     public.place_region not null,
  name       text not null unique,
  sort_order int  not null default 0,
  is_active  boolean not null default true
);

-- 거래방식 (복수선택 대상)
create table public.trade_methods (
  code       text primary key,
  name       text not null unique,
  sort_order int  not null default 0
);

-- 색상 (복수선택 대상)
create table public.colors (
  code       text primary key,
  name       text not null unique,
  hex        text check (hex ~ '^#[0-9A-Fa-f]{6}$'),  -- 멀티컬러는 비움
  sort_order int  not null default 0,
  is_active  boolean not null default true
);


-- =====================================================================
-- 리얼해브 DB 3/8 : 상품 · 사진 · 정품인증 · 복수선택 · 찜
-- =====================================================================

create type public.condition_grade as enum ('NEW', 'A+', 'A', 'B+', 'B', 'C');
create type public.product_status  as enum ('on_sale', 'sold', 'deleted');
create type public.auth_status     as enum ('pending', 'approved', 'rejected');
create type public.review_status   as enum ('pending', 'approved', 'rejected', 'needs_check');
create type public.review_method   as enum ('manual', 'ai');
create type public.cert_kind       as enum ('tag', 'invoice', 'receipt');
create type public.masking_status  as enum ('pending', 'done', 'failed');

-- 카테고리별 사이즈 선택지
create or replace function private.allowed_sizes(t public.size_type)
returns text[] language sql immutable set search_path = '' as $$
  select case t
    when 'clothing' then array['44','55','66','77','90','95','100','103','105','110','115','그외']
    when 'shoes'    then array(select g::text from generate_series(180, 300, 5) g)
    when 'kids'     then array['80','90','100','110','120','130','140','150','160','그외']
    else array[]::text[]
  end;
$$;

-- ---------------------------------------------------------------------
-- 상품
-- ---------------------------------------------------------------------
create table public.products (
  id                  uuid primary key default gen_random_uuid(),
  seller_id           uuid not null references public.profiles (id) on delete cascade,
  title               text not null check (char_length(btrim(title)) between 2 and 60),
  brand_id            uuid not null references public.brands (id),
  category_id         uuid not null references public.categories (id),
  purchase_place_code text not null references public.purchase_places (code),
  size                text,
  condition_grade     public.condition_grade not null,
  price               bigint not null check (price > 0 and price < 10000000000),
  description         text not null default '' check (char_length(description) <= 3000),
  status              public.product_status not null default 'on_sale',
  auth_status         public.auth_status not null default 'pending',
  view_count          int not null default 0,
  bumped_at           timestamptz not null default now(),
  source_product_id   uuid references public.products (id) on delete set null,  -- 재등록 원본
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  sold_at             timestamptz,
  deleted_at          timestamptz
);
create index products_feed_idx     on public.products (auth_status, status, bumped_at desc);
create index products_seller_idx   on public.products (seller_id, status);
create index products_brand_idx    on public.products (brand_id);
create index products_category_idx on public.products (category_id);

create trigger products_updated_at before update on public.products
  for each row execute function private.set_updated_at();

-- 상품 저장 전 검사
--  1) 소분류 카테고리 + 사이즈 규칙 (항상)
--  2) 앱 사용자는 보호 항목(심사상태·조회수·끌어올리기 등)을 직접 못 바꿈
--  3) 반려된 상품 수정 / 승인된 상품의 브랜드·카테고리·구매처 변경 → 재심사(pending)
create or replace function private.products_before()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  cat record;
begin
  select c.parent_id, c.size_type into cat
  from public.categories c where c.id = new.category_id;
  if cat.parent_id is null then
    raise exception '소분류 카테고리를 선택해주세요';
  end if;
  if cat.size_type = 'none' then
    if new.size is not null then
      raise exception '이 카테고리는 사이즈를 선택할 수 없습니다';
    end if;
  elsif new.size is null or not (new.size = any (private.allowed_sizes(cat.size_type))) then
    raise exception '사이즈를 목록에서 선택해주세요';
  end if;

  if private.is_trusted() then return new; end if;

  if tg_op = 'INSERT' then
    new.status            := 'on_sale';
    new.auth_status       := 'pending';
    new.view_count        := 0;
    new.bumped_at         := now();
    new.source_product_id := null;
    new.created_at        := now();
    new.sold_at           := null;
    new.deleted_at        := null;
    return new;
  end if;

  -- 이하 UPDATE
  if old.status = 'deleted' then
    raise exception '삭제된 상품은 수정할 수 없습니다';
  end if;

  if new.seller_id <> old.seller_id
     or new.view_count <> old.view_count
     or new.bumped_at <> old.bumped_at
     or new.auth_status <> old.auth_status
     or new.source_product_id is distinct from old.source_product_id
     or new.created_at <> old.created_at
     or new.sold_at is distinct from old.sold_at
     or new.deleted_at is distinct from old.deleted_at then
    raise exception '직접 변경할 수 없는 항목입니다';
  end if;

  -- 판매자가 아닌 관리자는 숨김(삭제)만 가능
  if old.seller_id <> auth.uid()
     and (new.title, new.brand_id, new.category_id, new.purchase_place_code, new.size,
          new.condition_grade, new.price, new.description)
         is distinct from
         (old.title, old.brand_id, old.category_id, old.purchase_place_code, old.size,
          old.condition_grade, old.price, old.description) then
    raise exception '관리자는 상품 내용을 수정할 수 없습니다';
  end if;

  if new.status <> old.status then
    if new.status <> 'deleted' then
      raise exception '거래완료는 거래완료 기능으로만 처리할 수 있습니다';
    end if;
    new.deleted_at := now();
    return new;
  end if;

  if old.status = 'sold' then
    raise exception '거래완료된 상품은 수정할 수 없습니다 (재등록을 이용해주세요)';
  end if;

  if old.seller_id = auth.uid()
     and (old.auth_status = 'rejected'
          or (old.auth_status = 'approved'
              and (new.brand_id <> old.brand_id
                   or new.category_id <> old.category_id
                   or new.purchase_place_code <> old.purchase_place_code))) then
    new.auth_status := 'pending';
  end if;
  return new;
end $$;

create trigger products_before before insert or update on public.products
  for each row execute function private.products_before();

-- ---------------------------------------------------------------------
-- 정품인증 심사 이력 (AI 확장 지점)
-- ---------------------------------------------------------------------
create table public.auth_reviews (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products (id) on delete cascade,
  method        public.review_method not null default 'manual',
  status        public.review_status not null default 'pending',
  ai_result     jsonb,          -- AI/OCR 분석 결과 (카드번호 등 원문은 저장 금지, 위치·판정만)
  ai_score      numeric,
  reviewer_id   uuid references public.profiles (id) on delete set null,
  reject_reason text,
  created_at    timestamptz not null default now(),
  decided_at    timestamptz
);
create index auth_reviews_product_idx on public.auth_reviews (product_id, created_at desc);
create index auth_reviews_pending_idx on public.auth_reviews (status, created_at) where status in ('pending', 'needs_check');

-- 상품이 심사대기로 들어갈 때마다 심사 이력 한 줄 추가
create or replace function private.products_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT' and new.auth_status = 'pending')
     or (tg_op = 'UPDATE' and new.auth_status = 'pending' and old.auth_status <> 'pending') then
    insert into public.auth_reviews (product_id, method, status)
    values (new.id, 'manual', 'pending');
  end if;
  return null;
end $$;

create trigger products_after after insert or update on public.products
  for each row execute function private.products_after();

-- ---------------------------------------------------------------------
-- 사진
-- ---------------------------------------------------------------------

-- 공개 상품사진 (최대 10장, sort_order 0 = 대표사진)
create table public.product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  storage_path text not null,
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id, sort_order);

-- 정품인증 증빙 (원본 비공개, 가린 사본은 로그인 회원만)
create table public.product_cert_images (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products (id) on delete cascade,
  kind           public.cert_kind not null,
  storage_path   text not null,          -- 원본 (cert-docs 버킷)
  masked_path    text,                   -- 가격·카드번호 가린 사본 (cert-masked 버킷, 서버만 기록)
  masking_status public.masking_status not null default 'pending',
  created_at     timestamptz not null default now()
);
create index product_cert_images_product_idx on public.product_cert_images (product_id);

-- 사진 개수 제한
create or replace function private.limit_images()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if tg_table_name = 'product_images' then
    select count(*) into n from public.product_images where product_id = new.product_id;
    if n >= 10 then raise exception '상품사진은 최대 10장까지 등록할 수 있습니다'; end if;
  else
    select count(*) into n from public.product_cert_images where product_id = new.product_id;
    if n >= 5 then raise exception '정품인증 사진은 최대 5장까지 등록할 수 있습니다'; end if;
  end if;
  return new;
end $$;

create trigger product_images_limit before insert on public.product_images
  for each row execute function private.limit_images();
create trigger product_cert_images_limit before insert on public.product_cert_images
  for each row execute function private.limit_images();

-- 인증사진: 앱 사용자는 마스킹 결과를 직접 기록 못 함
create or replace function private.cert_images_before()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_trusted() then
    new.masked_path    := null;
    new.masking_status := 'pending';
    new.created_at     := now();
  end if;
  return new;
end $$;

create trigger product_cert_images_before before insert on public.product_cert_images
  for each row execute function private.cert_images_before();

-- 인증사진이 추가/삭제되면 상품은 재심사
create or replace function private.cert_images_after()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  pid uuid := coalesce(new.product_id, old.product_id);
begin
  if private.is_trusted() then return null; end if;
  perform private.trusted_on();
  update public.products
     set auth_status = 'pending'
   where id = pid and auth_status <> 'pending' and status = 'on_sale';
  perform private.trusted_off();
  return null;
end $$;

create trigger product_cert_images_after after insert or delete on public.product_cert_images
  for each row execute function private.cert_images_after();

-- ---------------------------------------------------------------------
-- 복수선택 (거래방식 · 색상)
-- ---------------------------------------------------------------------
create table public.product_trade_methods (
  product_id        uuid not null references public.products (id) on delete cascade,
  trade_method_code text not null references public.trade_methods (code),
  primary key (product_id, trade_method_code)
);

create table public.product_colors (
  product_id uuid not null references public.products (id) on delete cascade,
  color_code text not null references public.colors (code),
  primary key (product_id, color_code)
);
create index product_colors_color_idx on public.product_colors (color_code);

-- ---------------------------------------------------------------------
-- 찜
-- ---------------------------------------------------------------------
create table public.wishlists (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index wishlists_product_idx on public.wishlists (product_id);

-- ---------------------------------------------------------------------
-- 권한 판단용 함수
-- ---------------------------------------------------------------------

-- 이 상품을 볼 수 있는가 (공개 조건 / 본인 / 상품관리자)
create or replace function private.can_view_product(pid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.products p
    join public.profiles s on s.id = p.seller_id
    where p.id = pid
      and (
        (p.auth_status = 'approved' and p.status in ('on_sale', 'sold') and s.status = 'active')
        or p.seller_id = auth.uid()
        or private.is_admin('product')
      )
  );
$$;

-- 내 상품인가 (삭제된 상품 제외)
create or replace function private.owns_product(pid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.products p
    where p.id = pid and p.seller_id = auth.uid() and p.status <> 'deleted'
  );
$$;

-- 로그인 회원에게 가린 인증사진 목록 제공 (원본 경로는 절대 안 나감)
create or replace function public.get_masked_cert_images(pid uuid)
returns table (id uuid, kind public.cert_kind, masked_path text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.kind, c.masked_path
  from public.product_cert_images c
  where c.product_id = pid
    and c.masking_status = 'done'
    and c.masked_path is not null
    and auth.uid() is not null
    and private.can_view_product(pid);
$$;
revoke execute on function public.get_masked_cert_images(uuid) from public, anon;
grant  execute on function public.get_masked_cert_images(uuid) to authenticated;


-- =====================================================================
-- 리얼해브 DB 4/8 : 채팅 · 메시지 · 거래완료
-- =====================================================================

-- 채팅방 (상품 1개 × 구매희망자 1명 = 방 1개)
create table public.chat_rooms (
  id                   uuid primary key default gen_random_uuid(),
  product_id           uuid not null references public.products (id) on delete cascade,
  seller_id            uuid not null references public.profiles (id) on delete cascade,
  buyer_id             uuid not null references public.profiles (id) on delete cascade,
  last_message_at      timestamptz,
  last_message_preview text,
  seller_last_read_at  timestamptz,
  buyer_last_read_at   timestamptz,
  created_at           timestamptz not null default now(),
  unique (product_id, buyer_id),
  check (seller_id <> buyer_id)
);
create index chat_rooms_buyer_idx  on public.chat_rooms (buyer_id, last_message_at desc);
create index chat_rooms_seller_idx on public.chat_rooms (seller_id, last_message_at desc);

-- 방 만들 때: 판매자는 상품 정보에서 자동으로, 판매중·승인 상품만
create or replace function private.chat_rooms_before()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  p record;
begin
  if private.is_trusted() then return new; end if;
  select seller_id, status, auth_status into p from public.products where id = new.product_id;
  if not found or p.status <> 'on_sale' or p.auth_status <> 'approved' then
    raise exception '판매중인 상품에만 채팅할 수 있습니다';
  end if;
  new.seller_id            := p.seller_id;
  new.last_message_at      := null;
  new.last_message_preview := null;
  new.seller_last_read_at  := null;
  new.buyer_last_read_at   := now();
  new.created_at           := now();
  return new;
end $$;

create trigger chat_rooms_before before insert on public.chat_rooms
  for each row execute function private.chat_rooms_before();

-- 메시지 (글 또는 사진)
create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.chat_rooms (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id) on delete cascade,
  body       text check (char_length(body) <= 1000),
  image_path text,   -- chat-images 버킷의 "방ID/파일명"
  created_at timestamptz not null default now(),
  check (nullif(btrim(body), '') is not null or image_path is not null)
);
create index messages_room_idx on public.messages (room_id, created_at desc);

create or replace function private.messages_before()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.is_trusted() then return new; end if;
  new.created_at := now();
  if new.image_path is not null and new.image_path not like new.room_id::text || '/%' then
    raise exception '잘못된 사진 경로입니다';
  end if;
  return new;
end $$;

create trigger messages_before before insert on public.messages
  for each row execute function private.messages_before();

-- 새 메시지 → 채팅방 목록 정보 갱신 (보낸 사람은 읽음 처리)
create or replace function private.messages_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.chat_rooms r
     set last_message_at      = new.created_at,
         last_message_preview = coalesce(left(nullif(btrim(new.body), ''), 100), '사진'),
         seller_last_read_at  = case when new.sender_id = r.seller_id then new.created_at else r.seller_last_read_at end,
         buyer_last_read_at   = case when new.sender_id = r.buyer_id  then new.created_at else r.buyer_last_read_at  end
   where r.id = new.room_id;
  return null;
end $$;

create trigger messages_after after insert on public.messages
  for each row execute function private.messages_after();

-- 거래완료 기록 (상품당 1건, 생성은 거래완료 함수로만 — 5단계에서 추가)
create table public.deals (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null unique references public.products (id) on delete cascade,
  seller_id         uuid not null references public.profiles (id) on delete cascade,
  buyer_id          uuid references public.profiles (id) on delete cascade,  -- "선택하지 않을래요"면 비움
  price             bigint not null check (price > 0),
  trade_method_code text references public.trade_methods (code),
  completed_at      timestamptz not null default now(),
  check (buyer_id is null or buyer_id <> seller_id)
);
create index deals_buyer_idx  on public.deals (buyer_id, completed_at desc);
create index deals_seller_idx on public.deals (seller_id, completed_at desc);

-- 채팅방 참여자인가
create or replace function private.is_room_participant(rid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.chat_rooms r
    where r.id = rid and auth.uid() in (r.seller_id, r.buyer_id)
  );
$$;


-- =====================================================================
-- 리얼해브 DB 5/8 : 신고 · 1:1 문의 · 공지/이벤트
-- =====================================================================

create type public.report_target  as enum ('product', 'user', 'chat');
create type public.report_reason  as enum ('fake_suspect', 'false_listing', 'no_response', 'bad_manner', 'etc');
create type public.report_status  as enum ('open', 'resolved', 'dismissed');
create type public.inquiry_status as enum ('waiting', 'answered');
create type public.notice_kind    as enum ('notice', 'event');

-- 신고
-- (대상이 탈퇴 등으로 지워져도 신고 기록은 남도록 대상 칸은 비워지게 함)
create table public.reports (
  id                uuid primary key default gen_random_uuid(),
  reporter_id       uuid not null references public.profiles (id) on delete cascade,
  target_type       public.report_target not null,
  target_product_id uuid references public.products (id) on delete set null,
  target_user_id    uuid references public.profiles (id) on delete set null,
  target_room_id    uuid references public.chat_rooms (id) on delete set null,
  reason            public.report_reason not null,
  detail            text check (char_length(detail) <= 1000),
  status            public.report_status not null default 'open',
  admin_note        text,
  handled_by        uuid references public.profiles (id) on delete set null,
  handled_at        timestamptz,
  created_at        timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at desc);
create index reports_room_idx   on public.reports (target_room_id) where target_room_id is not null;

create or replace function private.reports_before()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r record;
begin
  if private.is_trusted() then return new; end if;

  if tg_op = 'INSERT' then
    new.status     := 'open';
    new.admin_note := null;
    new.handled_by := null;
    new.handled_at := null;
    new.created_at := now();

    if new.target_type = 'product' then
      select seller_id into new.target_user_id from public.products where id = new.target_product_id;
      if not found then raise exception '신고할 상품이 없습니다'; end if;
      new.target_room_id := null;
    elsif new.target_type = 'user' then
      if new.target_user_id is null then raise exception '신고할 회원을 지정해주세요'; end if;
      new.target_product_id := null;
      new.target_room_id    := null;
    else  -- chat: 본인이 참여한 대화만 신고 가능, 상대방·상품 자동 기록
      select * into r from public.chat_rooms where id = new.target_room_id;
      if not found or auth.uid() not in (r.seller_id, r.buyer_id) then
        raise exception '참여한 대화만 신고할 수 있습니다';
      end if;
      new.target_product_id := r.product_id;
      new.target_user_id    := case when auth.uid() = r.seller_id then r.buyer_id else r.seller_id end;
    end if;

    if new.target_user_id = auth.uid() then
      raise exception '본인은 신고할 수 없습니다';
    end if;
    return new;
  end if;

  -- UPDATE (관리자 처리): 신고 내용은 그대로, 처리자·처리시각 자동 기록
  if (new.reporter_id, new.target_type, new.target_product_id, new.target_user_id,
      new.target_room_id, new.reason, new.detail, new.created_at)
     is distinct from
     (old.reporter_id, old.target_type, old.target_product_id, old.target_user_id,
      old.target_room_id, old.reason, old.detail, old.created_at) then
    raise exception '신고 내용은 수정할 수 없습니다';
  end if;
  if new.status <> old.status then
    new.handled_by := auth.uid();
    new.handled_at := now();
  end if;
  return new;
end $$;

create trigger reports_before before insert or update on public.reports
  for each row execute function private.reports_before();

-- 관리자 열람 허용 대상: 신고된 대화방인가
create or replace function private.is_reported_room(rid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.reports where target_room_id = rid);
$$;

-- 1:1 문의
create table public.inquiries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 100),
  body        text not null check (char_length(btrim(body)) between 1 and 3000),
  status      public.inquiry_status not null default 'waiting',
  answer      text,
  answered_by uuid references public.profiles (id) on delete set null,
  answered_at timestamptz,
  created_at  timestamptz not null default now()
);
create index inquiries_user_idx   on public.inquiries (user_id, created_at desc);
create index inquiries_status_idx on public.inquiries (status, created_at desc);

create or replace function private.inquiries_before()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.is_trusted() then return new; end if;
  if tg_op = 'INSERT' then
    new.status      := 'waiting';
    new.answer      := null;
    new.answered_by := null;
    new.answered_at := null;
    new.created_at  := now();
    return new;
  end if;
  if (new.user_id, new.title, new.body, new.created_at)
     is distinct from (old.user_id, old.title, old.body, old.created_at) then
    raise exception '문의 내용은 수정할 수 없습니다';
  end if;
  if new.answer is distinct from old.answer then
    new.status      := case when nullif(btrim(new.answer), '') is null then 'waiting' else 'answered' end;
    new.answered_by := auth.uid();
    new.answered_at := now();
  end if;
  return new;
end $$;

create trigger inquiries_before before insert or update on public.inquiries
  for each row execute function private.inquiries_before();

-- 공지사항 / 이벤트
create table public.notices (
  id           uuid primary key default gen_random_uuid(),
  kind         public.notice_kind not null default 'notice',
  title        text not null check (char_length(btrim(title)) between 1 and 100),
  body         text not null default '',
  is_published boolean not null default false,
  published_at timestamptz,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index notices_published_idx on public.notices (is_published, published_at desc);

create or replace function private.notices_before()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.is_published and new.published_at is null then
    new.published_at := now();
  end if;
  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by := auth.uid();
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger notices_before before insert or update on public.notices
  for each row execute function private.notices_before();


-- =====================================================================
-- 리얼해브 DB 6/8 : RLS (행 단위 보안) — 모든 테이블
--   규칙이 없는 동작은 자동 차단됩니다.
-- =====================================================================

alter table public.profiles              enable row level security;
alter table public.user_private          enable row level security;
alter table public.admins                enable row level security;
alter table public.categories            enable row level security;
alter table public.brands                enable row level security;
alter table public.purchase_places       enable row level security;
alter table public.trade_methods         enable row level security;
alter table public.colors                enable row level security;
alter table public.products              enable row level security;
alter table public.auth_reviews          enable row level security;
alter table public.product_images        enable row level security;
alter table public.product_cert_images   enable row level security;
alter table public.product_trade_methods enable row level security;
alter table public.product_colors        enable row level security;
alter table public.wishlists             enable row level security;
alter table public.chat_rooms            enable row level security;
alter table public.messages              enable row level security;
alter table public.deals                 enable row level security;
alter table public.reports               enable row level security;
alter table public.inquiries             enable row level security;
alter table public.notices               enable row level security;

-- ---------- 회원 ----------
create policy "profiles: 누구나 조회" on public.profiles
  for select to anon, authenticated using (true);
create policy "profiles: 본인 또는 master 수정" on public.profiles
  for update to authenticated
  using      (id = (select auth.uid()) or private.is_admin('master'))
  with check (id = (select auth.uid()) or private.is_admin('master'));

create policy "user_private: 본인·CS 조회" on public.user_private
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin('cs'));
create policy "user_private: master 수정" on public.user_private
  for update to authenticated
  using (private.is_admin('master')) with check (private.is_admin('master'));

-- ---------- 관리자 ----------
create policy "admins: 본인·master 조회" on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin('master'));
create policy "admins: master 추가" on public.admins
  for insert to authenticated with check (private.is_admin('master'));
create policy "admins: master 수정 (자기 자신 제외)" on public.admins
  for update to authenticated
  using      (private.is_admin('master') and user_id <> (select auth.uid()))
  with check (private.is_admin('master') and user_id <> (select auth.uid()));
create policy "admins: master 삭제 (자기 자신 제외)" on public.admins
  for delete to authenticated
  using (private.is_admin('master') and user_id <> (select auth.uid()));

-- ---------- 기준 데이터 ----------
create policy "categories: 조회" on public.categories
  for select to anon, authenticated using (is_active or private.is_admin('product'));
create policy "categories: 상품관리자 관리" on public.categories
  for all to authenticated
  using (private.is_admin('product')) with check (private.is_admin('product'));

create policy "brands: 조회" on public.brands
  for select to anon, authenticated using (is_active or private.is_admin('product'));
create policy "brands: 상품관리자 관리" on public.brands
  for all to authenticated
  using (private.is_admin('product')) with check (private.is_admin('product'));

create policy "purchase_places: 조회" on public.purchase_places
  for select to anon, authenticated using (is_active or private.is_admin('product'));
create policy "purchase_places: 상품관리자 관리" on public.purchase_places
  for all to authenticated
  using (private.is_admin('product')) with check (private.is_admin('product'));

create policy "trade_methods: 조회" on public.trade_methods
  for select to anon, authenticated using (true);
create policy "trade_methods: 상품관리자 관리" on public.trade_methods
  for all to authenticated
  using (private.is_admin('product')) with check (private.is_admin('product'));

create policy "colors: 조회" on public.colors
  for select to anon, authenticated using (is_active or private.is_admin('product'));
create policy "colors: 상품관리자 관리" on public.colors
  for all to authenticated
  using (private.is_admin('product')) with check (private.is_admin('product'));

-- ---------- 상품 ----------
create policy "products: 공개·본인·상품관리자 조회" on public.products
  for select to anon, authenticated
  using (
    (auth_status = 'approved' and status in ('on_sale', 'sold')
      and exists (select 1 from public.profiles s where s.id = seller_id and s.status = 'active'))
    or seller_id = (select auth.uid())
    or private.is_admin('product')
  );
create policy "products: 활동회원 본인 등록" on public.products
  for insert to authenticated
  with check (seller_id = (select auth.uid()) and private.is_active_user());
create policy "products: 본인 수정 또는 상품관리자 숨김" on public.products
  for update to authenticated
  using      ((seller_id = (select auth.uid()) and private.is_active_user()) or private.is_admin('product'))
  with check ((seller_id = (select auth.uid()) and private.is_active_user()) or private.is_admin('product'));
-- 삭제 규칙 없음: 삭제는 status='deleted'로 표시

create policy "auth_reviews: 판매자·상품관리자 조회" on public.auth_reviews
  for select to authenticated
  using (
    exists (select 1 from public.products p where p.id = product_id and p.seller_id = (select auth.uid()))
    or private.is_admin('product')
  );
-- 추가/수정은 내부 함수만

create policy "product_images: 조회" on public.product_images
  for select to anon, authenticated using (private.can_view_product(product_id));
create policy "product_images: 판매자 등록" on public.product_images
  for insert to authenticated
  with check (private.owns_product(product_id) and private.is_active_user());
create policy "product_images: 판매자 순서변경" on public.product_images
  for update to authenticated
  using (private.owns_product(product_id)) with check (private.owns_product(product_id));
create policy "product_images: 판매자 삭제" on public.product_images
  for delete to authenticated using (private.owns_product(product_id));

create policy "product_cert_images: 판매자·상품관리자 조회" on public.product_cert_images
  for select to authenticated
  using (private.owns_product(product_id) or private.is_admin('product'));
create policy "product_cert_images: 판매자 등록" on public.product_cert_images
  for insert to authenticated
  with check (private.owns_product(product_id) and private.is_active_user());
create policy "product_cert_images: 판매자 삭제" on public.product_cert_images
  for delete to authenticated using (private.owns_product(product_id));
-- 수정(마스킹 결과 기록)은 서버만

create policy "product_trade_methods: 조회" on public.product_trade_methods
  for select to anon, authenticated using (private.can_view_product(product_id));
create policy "product_trade_methods: 판매자 선택" on public.product_trade_methods
  for insert to authenticated
  with check (private.owns_product(product_id) and private.is_active_user());
create policy "product_trade_methods: 판매자 해제" on public.product_trade_methods
  for delete to authenticated using (private.owns_product(product_id));

create policy "product_colors: 조회" on public.product_colors
  for select to anon, authenticated using (private.can_view_product(product_id));
create policy "product_colors: 판매자 선택" on public.product_colors
  for insert to authenticated
  with check (private.owns_product(product_id) and private.is_active_user());
create policy "product_colors: 판매자 해제" on public.product_colors
  for delete to authenticated using (private.owns_product(product_id));

-- ---------- 찜 ----------
create policy "wishlists: 본인 조회" on public.wishlists
  for select to authenticated using (user_id = (select auth.uid()));
create policy "wishlists: 본인 추가" on public.wishlists
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_active_user()
              and private.can_view_product(product_id));
create policy "wishlists: 본인 삭제" on public.wishlists
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------- 채팅 ----------
create policy "chat_rooms: 당사자 또는 신고된 방은 CS 조회" on public.chat_rooms
  for select to authenticated
  using (
    (select auth.uid()) in (seller_id, buyer_id)
    or (private.is_admin('cs') and private.is_reported_room(id))
  );
create policy "chat_rooms: 활동회원이 구매자로 개설" on public.chat_rooms
  for insert to authenticated
  with check (buyer_id = (select auth.uid()) and private.is_active_user());
-- 수정(읽음 처리)은 5단계 전용 함수로

create policy "messages: 당사자 또는 신고된 방은 CS 조회" on public.messages
  for select to authenticated
  using (
    private.is_room_participant(room_id)
    or (private.is_admin('cs') and private.is_reported_room(room_id))
  );
create policy "messages: 당사자 전송" on public.messages
  for insert to authenticated
  with check (sender_id = (select auth.uid()) and private.is_active_user()
              and private.is_room_participant(room_id));
-- 수정·삭제 없음

-- ---------- 거래 ----------
create policy "deals: 판매자·구매자·관리자 조회" on public.deals
  for select to authenticated
  using ((select auth.uid()) in (seller_id, buyer_id) or private.is_admin());
-- 생성은 거래완료 함수만

-- ---------- 신고 / 문의 / 공지 ----------
create policy "reports: 신고자·CS 조회" on public.reports
  for select to authenticated
  using (reporter_id = (select auth.uid()) or private.is_admin('cs'));
create policy "reports: 활동회원 신고" on public.reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()) and private.is_active_user());
create policy "reports: CS 처리" on public.reports
  for update to authenticated
  using (private.is_admin('cs')) with check (private.is_admin('cs'));

create policy "inquiries: 작성자·CS 조회" on public.inquiries
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin('cs'));
create policy "inquiries: 회원 작성" on public.inquiries
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "inquiries: CS 답변" on public.inquiries
  for update to authenticated
  using (private.is_admin('cs')) with check (private.is_admin('cs'));

create policy "notices: 게시글 조회" on public.notices
  for select to anon, authenticated using (is_published or private.is_admin('cs'));
create policy "notices: CS 관리" on public.notices
  for all to authenticated
  using (private.is_admin('cs')) with check (private.is_admin('cs'));


-- =====================================================================
-- 리얼해브 DB 7/8 : 사진 저장소(Storage) 버킷과 규칙
--   경로 규칙
--   product-images : {회원ID}/{상품ID}/{파일}   공개
--   cert-docs      : {회원ID}/{상품ID}/{파일}   비공개 (원본 택·인보이스)
--   cert-masked    : {상품ID}/{파일}            비공개 (가린 사본, 서버만 저장)
--   chat-images    : {채팅방ID}/{파일}          비공개
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('product-images', 'product-images', true,  10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('cert-docs',      'cert-docs',      false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('cert-masked',    'cert-masked',    false, 10485760, array['image/jpeg','image/png','image/webp']),
  ('chat-images',    'chat-images',    false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

-- 상품사진: 본인 폴더에만 올리기/바꾸기/지우기 (보기는 공개 링크)
create policy "realhave product-images 본인 조회" on storage.objects
  for select to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "realhave product-images 본인 업로드" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images'
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and private.is_active_user());
create policy "realhave product-images 본인 수정" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "realhave product-images 본인 삭제" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 인증서류 원본: 본인 업로드, 본인·상품관리자만 보기
create policy "realhave cert-docs 본인·상품관리자 조회" on storage.objects
  for select to authenticated
  using (bucket_id = 'cert-docs'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or private.is_admin('product')));
create policy "realhave cert-docs 본인 업로드" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'cert-docs'
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and private.is_active_user());
create policy "realhave cert-docs 본인 삭제" on storage.objects
  for delete to authenticated
  using (bucket_id = 'cert-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 가린 사본: 로그인 회원이 볼 수 있는 상품이면 보기 (저장은 서버만)
create policy "realhave cert-masked 로그인회원 조회" on storage.objects
  for select to authenticated
  using (bucket_id = 'cert-masked'
         and private.can_view_product(private.to_uuid((storage.foldername(name))[1])));

-- 채팅사진: 그 방 당사자만, 신고된 방은 CS도 보기
create policy "realhave chat-images 당사자 업로드" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-images'
              and private.is_room_participant(private.to_uuid((storage.foldername(name))[1]))
              and private.is_active_user());
create policy "realhave chat-images 당사자·CS 조회" on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-images'
         and (private.is_room_participant(private.to_uuid((storage.foldername(name))[1]))
              or (private.is_admin('cs')
                  and private.is_reported_room(private.to_uuid((storage.foldername(name))[1])))));


-- =====================================================================
-- 리얼해브 DB 8/8 : API 접근 권한 명시
--   Supabase 프로젝트 설정과 관계없이 동일하게 동작하도록 권한을 직접 지정.
--   실제로 무엇을 볼 수 있는지는 6번 파일의 RLS 규칙이 결정합니다.
-- =====================================================================

-- 비회원: 조회만
grant select on all tables in schema public to anon;
-- 회원: 조회·추가·수정·삭제 (행 단위 허용 여부는 RLS가 판단)
grant select, insert, update, delete on all tables in schema public to authenticated;
-- 서버(service_role)
grant all on all tables in schema public to service_role;

-- 권한 판단 함수 실행 권한
grant execute on all functions in schema private to anon, authenticated, service_role;

-- 가린 인증사진 목록 함수는 로그인 회원만
revoke execute on function public.get_masked_cert_images(uuid) from public, anon;
grant  execute on function public.get_masked_cert_images(uuid) to authenticated;


-- =====================================================================
-- 리얼해브 기초 데이터 (목업 기준) — 테이블 생성 후 1번만 실행
-- =====================================================================

-- 구매처
insert into public.purchase_places (code, region, name, sort_order) values
  ('dom_h_dept',   'domestic', '국내H백화점', 1),
  ('dom_l_dept',   'domestic', '국내L백화점', 2),
  ('dom_s_dept',   'domestic', '국내S백화점', 3),
  ('dom_roadshop', 'domestic', '국내로드샵',  4),
  ('dom_dutyfree', 'domestic', '국내면세점',  5),
  ('dom_etc',      'domestic', '국내구매',    6),
  ('ovs_dept',     'overseas', '해외백화점',  7),
  ('ovs_roadshop', 'overseas', '해외로드샵',  8),
  ('ovs_dutyfree', 'overseas', '해외면세점',  9),
  ('ovs_etc',      'overseas', '해외구매',   10);

-- 거래방식
insert into public.trade_methods (code, name, sort_order) values
  ('direct',      '직거래',   1),
  ('parcel',      '일반택배', 2),
  ('half_parcel', '반값택배', 3);

-- 색상 12개 (목업 순서)
insert into public.colors (code, name, hex, sort_order) values
  ('black',  '블랙',     '#111111',  1),
  ('blue',   '블루',     '#1E3A8A',  2),
  ('brown',  '브라운',   '#6B5B34',  3),
  ('green',  '그린',     '#0F7B4E',  4),
  ('gray',   '그레이',   '#8B8F97',  5),
  ('multi',  '멀티컬러', null,       6),
  ('pink',   '핑크',     '#F07C99',  7),
  ('purple', '퍼플',     '#4B2E9E',  8),
  ('red',    '레드',     '#D2123B',  9),
  ('white',  '화이트',   '#FFFFFF', 10),
  ('yellow', '옐로우',   '#F5C518', 11),
  ('navy',   '네이비',   '#1B2A4A', 12);

-- 카테고리 13개 대분류 + 소분류
with top (name, size_type, sort_order, subs) as (
  values
    ('여성의류',    'clothing'::public.size_type,  1, array['티셔츠','블라우스/셔츠','스커트','원피스','팬츠','니트/가디건','점퍼/자켓','코트','수영복','기타']),
    ('남성의류',    'clothing'::public.size_type,  2, array['티셔츠','셔츠','팬츠','니트/가디건','점퍼/자켓','정장','코트','다운재킷','수영복','기타']),
    ('여성슈즈',    'shoes'::public.size_type,     3, array['스니커즈','샌들','로퍼','부츠','하이힐/구두','기타']),
    ('남성슈즈',    'shoes'::public.size_type,     4, array['스니커즈','로퍼','구두','기타']),
    ('가방/핸드백', 'none'::public.size_type,      5, array['여성가방','남성가방','여성크로스백','남성크로스백','백팩','서류가방','여행가방/캐리어','토트백/버킷백','숄더백/체인백','슬링백/웨이스트백']),
    ('지갑/벨트',   'none'::public.size_type,      6, array['여성지갑','남성지갑','여성벨트','남성벨트','카드지갑/코인케이스']),
    ('시계',        'none'::public.size_type,      7, array['남성시계','여성시계','시계밴드','기타']),
    ('주얼리',      'none'::public.size_type,      8, array['목걸이/펜던트','팔찌/뱅글','반지','브로치/뱃지','귀걸이','기타']),
    ('아이웨어',    'none'::public.size_type,      9, array['선글라스','안경테']),
    ('유아동(남)',  'kids'::public.size_type,     10, array['티셔츠','셔츠','팬츠','니트/가디건','점퍼/자켓','코트','다운재킷','수영복','기타']),
    ('유아동(여)',  'kids'::public.size_type,     11, array['티셔츠','셔츠','팬츠','니트/가디건','점퍼/자켓','코트','다운재킷','수영복','기타']),
    ('가전',        'none'::public.size_type,     12, array['핸드폰','이어폰','헤드폰','스피커/엠프','조명기기','카메라','카메라렌즈','카메라용품','스타일러','세탁기','건조기','공기청정기','청소기']),
    ('가구',        'none'::public.size_type,     13, array['침대','의자','책상','식탁','협탁','장식장'])
),
inserted as (
  insert into public.categories (name, size_type, sort_order)
  select name, size_type, sort_order from top
  returning id, name
)
insert into public.categories (parent_id, name, sort_order)
select i.id, s.sub, s.ord
from inserted i
join top t on t.name = i.name
cross join lateral unnest(t.subs) with ordinality as s(sub, ord);

-- 브랜드 (목업에 나온 브랜드만 — 나머지는 관리자 화면에서 추가)
insert into public.brands (name_en, name_ko, origin_country, is_popular, popular_order) values
  ('LOUIS VUITTON',   '루이비통',     '프랑스',   true, 1),
  ('HERMÈS',          '에르메스',     '프랑스',   true, 2),
  ('CHANEL',          '샤넬',         '프랑스',   true, 3),
  ('BANG & OLUFSEN',  '뱅앤올룹슨',   '덴마크',   true, 4),
  ('TIFFANY & CO.',   '티파니앤코',   '미국',     true, 5),
  ('ROLEX',           '롤렉스',       '스위스',   true, 6),
  ('GUCCI',           '구찌',         '이탈리아', true, 7),
  ('PRADA',           '프라다',       '이탈리아', true, 8),
  ('LORO PIANA',      '로로피아나',   '이탈리아', true, 9),
  ('CASIMA',          '카시마',       '이탈리아', false, null);


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
