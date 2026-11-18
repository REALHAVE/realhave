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
