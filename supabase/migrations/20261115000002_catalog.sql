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
