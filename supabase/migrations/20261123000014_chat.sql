-- =====================================================================
-- 리얼해브 DB 14 : 찜 · 채팅 (8단계)
--  - 채팅 시작 (상품 1개 × 구매희망자 1명 = 방 1개, 이미 있으면 그 방)
--  - 읽음 처리 / 내 채팅 목록 (안 읽은 수 포함) / 안 읽은 총합
--  - 실시간: 새 메시지·채팅방 변경을 화면에 바로 전달 (RLS 그대로 적용)
-- 이 파일을 Supabase SQL Editor에서 1번 실행하세요.
-- =====================================================================

-- 1) 채팅 시작 ---------------------------------------------------------
--  security invoker: 구매자 본인 권한으로 (정상회원만, 판매중·승인 상품만 — 기존 트리거·RLS)
create or replace function public.start_chat(p_product_id uuid)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  rid uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;

  select id into rid from public.chat_rooms
   where product_id = p_product_id and buyer_id = auth.uid();
  if rid is not null then
    return rid;
  end if;

  if exists (select 1 from public.products where id = p_product_id and seller_id = auth.uid()) then
    raise exception '내 상품에는 채팅을 시작할 수 없어요';
  end if;

  insert into public.chat_rooms (product_id, buyer_id, seller_id)
  values (p_product_id, auth.uid(), auth.uid())  -- seller_id 는 트리거가 상품 정보로 바꿈
  returning id into rid;
  return rid;
end $$;

-- 2) 읽음 처리 ---------------------------------------------------------
create or replace function public.mark_room_read(p_room_id uuid)
returns void
language sql security definer set search_path = '' as $$
  update public.chat_rooms
     set seller_last_read_at = case when seller_id = auth.uid() then now() else seller_last_read_at end,
         buyer_last_read_at  = case when buyer_id  = auth.uid() then now() else buyer_last_read_at  end
   where id = p_room_id
     and auth.uid() in (seller_id, buyer_id);
$$;

-- 3) 내 채팅 목록 (최근 대화 순, 안 읽은 수 포함) ----------------------
create or replace function public.my_chat_rooms()
returns table (
  room_id         uuid,
  product_id      uuid,
  product_title   text,
  brand_name      text,
  product_price   bigint,
  product_status  public.product_status,
  thumb_path      text,
  i_am_seller     boolean,
  other_id        uuid,
  other_nickname  text,
  last_message_at timestamptz,
  last_message    text,
  unread          int
)
language sql stable security definer set search_path = '' as $$
  select
    r.id,
    p.id,
    p.title,
    b.name_en,
    p.price,
    p.status,
    (select i.storage_path from public.product_images i
      where i.product_id = p.id order by i.sort_order limit 1),
    r.seller_id = auth.uid(),
    case when r.seller_id = auth.uid() then r.buyer_id else r.seller_id end,
    o.nickname,
    coalesce(r.last_message_at, r.created_at),
    r.last_message_preview,
    (select count(*)::int from public.messages m
      where m.room_id = r.id
        and m.sender_id <> auth.uid()
        and m.created_at > coalesce(
              case when r.seller_id = auth.uid() then r.seller_last_read_at else r.buyer_last_read_at end,
              '-infinity'::timestamptz))
  from public.chat_rooms r
  join public.products p on p.id = r.product_id
  join public.brands b   on b.id = p.brand_id
  join public.profiles o on o.id = case when r.seller_id = auth.uid() then r.buyer_id else r.seller_id end
  where auth.uid() in (r.seller_id, r.buyer_id)
    and (r.last_message_at is not null or r.buyer_id = auth.uid())  -- 판매자에게는 대화가 시작된 방만
  order by coalesce(r.last_message_at, r.created_at) desc
  limit 200;
$$;

-- 4) 안 읽은 메시지 총합 (마이페이지·하단 탭 표시용) --------------------
create or replace function public.my_unread_total()
returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(sum((
    select count(*) from public.messages m
     where m.room_id = r.id
       and m.sender_id <> auth.uid()
       and m.created_at > coalesce(
             case when r.seller_id = auth.uid() then r.seller_last_read_at else r.buyer_last_read_at end,
             '-infinity'::timestamptz))), 0)::int
  from public.chat_rooms r
  where auth.uid() in (r.seller_id, r.buyer_id);
$$;

-- 권한
revoke all on function public.start_chat(uuid)     from public, anon;
revoke all on function public.mark_room_read(uuid) from public, anon;
revoke all on function public.my_chat_rooms()      from public, anon;
revoke all on function public.my_unread_total()    from public, anon;
grant execute on function public.start_chat(uuid)     to authenticated;
grant execute on function public.mark_room_read(uuid) to authenticated;
grant execute on function public.my_chat_rooms()      to authenticated;
grant execute on function public.my_unread_total()    to authenticated;

-- 5) 실시간 -----------------------------------------------------------
--  Supabase Realtime 이 messages·chat_rooms 변경을 화면에 보냄.
--  보는 사람의 조회 권한(RLS)을 그대로 적용하므로 남의 대화는 전달되지 않음.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_rooms') then
    alter publication supabase_realtime add table public.chat_rooms;
  end if;
end $$;
