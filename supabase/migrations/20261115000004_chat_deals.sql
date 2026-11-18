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
