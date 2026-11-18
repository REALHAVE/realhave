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
