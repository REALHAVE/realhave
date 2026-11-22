-- =====================================================================
-- 리얼해브 DB 13 : 판매 관리 (9단계 ①)
--  - 끌어올리기 (상품별 24시간 1회)
--  - 게시글 수정 (사진·인증사진 포함) → 규칙에 따라 자동 재심사
--  - 거래완료 (구매자 선택 / 선택 안 함)
--  - 재등록 (거래완료 상품을 새 글로 복사, 심사대기)
--  - 조회수 증가
--  - 목록 뷰에 조회수 추가
-- 이 파일을 Supabase SQL Editor에서 1번 실행하세요.
-- =====================================================================

-- 0) 목록 뷰에 조회수 추가 (맨 뒤에 열 추가)
create or replace view public.product_cards
with (security_invoker = true) as
select
  p.id,
  p.seller_id,
  p.title,
  p.price,
  p.condition_grade,
  p.size,
  p.status,
  p.auth_status,
  p.bumped_at,
  p.created_at,
  (p.bumped_at > now() - interval '72 hours') as is_new,
  b.id               as brand_id,
  b.name_en          as brand_name,
  b.name_ko          as brand_name_ko,
  c.id               as category_id,
  c.name             as category_name,
  top.id             as top_category_id,
  top.name           as top_category_name,
  pp.name            as purchase_place_name,
  (select i.storage_path
     from public.product_images i
    where i.product_id = p.id
    order by i.sort_order, i.created_at
    limit 1)         as thumb_path,
  lower(concat_ws(' ', p.title, b.name_en, b.name_ko, c.name, top.name)) as search_text,
  p.view_count,
  p.sold_at
from public.products p
join public.brands b           on b.id = p.brand_id
join public.categories c       on c.id = p.category_id
join public.categories top     on top.id = c.parent_id
join public.purchase_places pp on pp.code = p.purchase_place_code;

-- 1) 끌어올리기 -------------------------------------------------------
create or replace function public.bump_product(p_product_id uuid)
returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  prod record;
  next_at timestamptz;
begin
  select id, seller_id, status, auth_status, bumped_at into prod
  from public.products where id = p_product_id for update;

  if prod.id is null or prod.seller_id <> auth.uid() then
    raise exception '내 상품만 끌어올릴 수 있습니다';
  end if;
  if not private.is_active_user() then
    raise exception '이용이 제한된 계정입니다';
  end if;
  if prod.status <> 'on_sale' or prod.auth_status <> 'approved' then
    raise exception '공개중인 판매 상품만 끌어올릴 수 있습니다';
  end if;

  next_at := prod.bumped_at + interval '24 hours';
  if next_at > now() then
    raise exception '끌어올리기는 24시간에 한 번 할 수 있어요 (% 시간 후 가능)',
      ceil(extract(epoch from (next_at - now())) / 3600)::int;
  end if;

  perform private.trusted_on();
  update public.products set bumped_at = now() where id = p_product_id;
  perform private.trusted_off();
  return now();
end $$;

-- 2) 게시글 수정 ------------------------------------------------------
--  security invoker: 판매자 본인 권한(RLS)으로 실행
--  자동 재심사 규칙(기존 트리거): 반려 상품 수정 / 승인 상품의 브랜드·카테고리·구매처 변경 / 인증사진 추가·삭제
create or replace function public.update_product(
  p_id          uuid,
  p_title       text,
  p_brand_id    uuid,
  p_category_id uuid,
  p_place_code  text,
  p_size        text,
  p_grade       public.condition_grade,
  p_price       bigint,
  p_description text,
  p_image_paths text[],   -- 최종 사진 목록 (기존 + 새로 올린 것, 순서대로)
  p_cert        jsonb,    -- 최종 인증사진 목록 [{"path","kind"}] (기존 + 새로 올린 것)
  p_colors      text[],
  p_trades      text[]
)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  uid    uuid := auth.uid();
  prefix text := uid::text || '/' || p_id::text || '/';
  n_img  int  := coalesce(array_length(p_image_paths, 1), 0);
  n_cert int  := coalesce(jsonb_array_length(p_cert), 0);
  path   text;
  owner  uuid;
begin
  select seller_id into owner from public.products where id = p_id and status <> 'deleted';
  if owner is null or owner <> uid then
    raise exception '내 상품만 수정할 수 있습니다';
  end if;
  if n_img < 1 or n_img > 10 then
    raise exception '상품 사진은 1~10장 등록해주세요';
  end if;
  if n_cert < 1 or n_cert > 3 then
    raise exception '정품인증 사진은 1~3장 등록해주세요';
  end if;
  if coalesce(array_length(p_trades, 1), 0) < 1 then
    raise exception '거래방식을 1개 이상 선택해주세요';
  end if;

  -- 사진: 이 상품에 이미 있던 것이거나, 이 상품 폴더에 새로 올린 것만
  foreach path in array p_image_paths loop
    if not exists (select 1 from public.product_images where product_id = p_id and storage_path = path)
       and (left(path, length(prefix)) <> prefix
            or not exists (select 1 from storage.objects o
                           where o.bucket_id = 'product-images' and o.name = path)) then
      raise exception '상품 사진 업로드를 확인해주세요';
    end if;
  end loop;
  for path in select c ->> 'path' from jsonb_array_elements(p_cert) c loop
    if path is null
       or (not exists (select 1 from public.product_cert_images where product_id = p_id and storage_path = path)
           and (left(path, length(prefix)) <> prefix
                or not exists (select 1 from storage.objects o
                               where o.bucket_id = 'cert-docs' and o.name = path))) then
      raise exception '정품인증 사진 업로드를 확인해주세요';
    end if;
  end loop;

  -- 본문 (거래완료 상품은 트리거가 수정을 막음)
  update public.products
     set title = btrim(p_title),
         brand_id = p_brand_id,
         category_id = p_category_id,
         purchase_place_code = p_place_code,
         size = nullif(p_size, ''),
         condition_grade = p_grade,
         price = p_price,
         description = coalesce(p_description, '')
   where id = p_id;

  -- 상품사진: 새 순서로 다시 저장
  delete from public.product_images where product_id = p_id;
  insert into public.product_images (product_id, storage_path, sort_order)
  select p_id, t.path, t.ord - 1
  from unnest(p_image_paths) with ordinality as t(path, ord);

  -- 인증사진: 빠진 것만 지우고 새것만 추가 (그대로면 재심사 안 걸림)
  delete from public.product_cert_images ci
   where ci.product_id = p_id
     and ci.storage_path not in (select c ->> 'path' from jsonb_array_elements(p_cert) c);
  insert into public.product_cert_images (product_id, kind, storage_path)
  select p_id, (c ->> 'kind')::public.cert_kind, c ->> 'path'
  from jsonb_array_elements(p_cert) c
  where not exists (select 1 from public.product_cert_images ci
                    where ci.product_id = p_id and ci.storage_path = c ->> 'path');

  delete from public.product_colors where product_id = p_id;
  insert into public.product_colors (product_id, color_code)
  select distinct p_id, x from unnest(coalesce(p_colors, '{}')) x;

  delete from public.product_trade_methods where product_id = p_id;
  insert into public.product_trade_methods (product_id, trade_method_code)
  select distinct p_id, x from unnest(p_trades) x;

  return p_id;
end $$;

-- 3) 거래완료 ---------------------------------------------------------
--  구매자는 그 상품으로 채팅한 사람 중에서만 (채팅은 8단계). null = "선택하지 않을래요"
create or replace function public.complete_deal(
  p_product_id uuid,
  p_buyer_id   uuid default null,
  p_trade_code text default null
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  prod record;
begin
  select id, seller_id, status, price into prod
  from public.products where id = p_product_id for update;

  if prod.id is null or prod.seller_id <> auth.uid() then
    raise exception '내 상품만 거래완료로 바꿀 수 있습니다';
  end if;
  if prod.status <> 'on_sale' then
    raise exception '판매중인 상품만 거래완료로 바꿀 수 있습니다';
  end if;
  if p_buyer_id is not null and not exists (
       select 1 from public.chat_rooms r
       where r.product_id = p_product_id and r.buyer_id = p_buyer_id) then
    raise exception '이 상품으로 채팅한 회원만 구매자로 선택할 수 있습니다';
  end if;

  insert into public.deals (product_id, seller_id, buyer_id, price, trade_method_code)
  values (p_product_id, prod.seller_id, p_buyer_id, prod.price, p_trade_code);

  perform private.trusted_on();
  update public.products set status = 'sold', sold_at = now() where id = p_product_id;
  perform private.trusted_off();
end $$;

-- 4) 재등록 (거래완료 상품 → 새 글, 심사대기) --------------------------
create or replace function public.relist_product(p_product_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  prod   record;
  new_id uuid := gen_random_uuid();
begin
  select * into prod from public.products where id = p_product_id;

  if prod.id is null or prod.seller_id <> auth.uid() then
    raise exception '내 상품만 재등록할 수 있습니다';
  end if;
  if not private.is_active_user() then
    raise exception '이용이 제한된 계정입니다';
  end if;
  if prod.status <> 'sold' then
    raise exception '거래완료된 상품만 재등록할 수 있습니다';
  end if;

  perform private.trusted_on();

  insert into public.products (
    id, seller_id, title, brand_id, category_id, purchase_place_code, size,
    condition_grade, price, description, status, auth_status, bumped_at, source_product_id
  ) values (
    new_id, prod.seller_id, prod.title, prod.brand_id, prod.category_id, prod.purchase_place_code,
    prod.size, prod.condition_grade, prod.price, prod.description, 'on_sale', 'pending', now(), prod.id
  );

  -- 사진 파일은 원래 글과 같이 씀 (원래 글은 실제로 지워지지 않음)
  insert into public.product_images (product_id, storage_path, sort_order)
  select new_id, storage_path, sort_order from public.product_images where product_id = prod.id;
  insert into public.product_cert_images (product_id, kind, storage_path)
  select new_id, kind, storage_path from public.product_cert_images where product_id = prod.id;
  insert into public.product_colors (product_id, color_code)
  select new_id, color_code from public.product_colors where product_id = prod.id;
  insert into public.product_trade_methods (product_id, trade_method_code)
  select new_id, trade_method_code from public.product_trade_methods where product_id = prod.id;

  perform private.trusted_off();
  return new_id;
end $$;

-- 5) 조회수 (공개 상품, 판매자 본인 조회는 제외) ----------------------
create or replace function public.increment_view(p_product_id uuid)
returns void
language sql security definer set search_path = '' as $$
  select private.trusted_on();
  update public.products
     set view_count = view_count + 1
   where id = p_product_id
     and status = 'on_sale'
     and auth_status = 'approved'
     and seller_id is distinct from auth.uid();
  select private.trusted_off();
$$;

-- 권한
revoke all on function public.bump_product(uuid) from public, anon;
grant execute on function public.bump_product(uuid) to authenticated;

revoke all on function public.update_product(
  uuid, text, uuid, uuid, text, text, public.condition_grade, bigint, text, text[], jsonb, text[], text[]
) from public, anon;
grant execute on function public.update_product(
  uuid, text, uuid, uuid, text, text, public.condition_grade, bigint, text, text[], jsonb, text[], text[]
) to authenticated;

revoke all on function public.complete_deal(uuid, uuid, text) from public, anon;
grant execute on function public.complete_deal(uuid, uuid, text) to authenticated;

revoke all on function public.relist_product(uuid) from public, anon;
grant execute on function public.relist_product(uuid) to authenticated;

revoke all on function public.increment_view(uuid) from public;
grant execute on function public.increment_view(uuid) to anon, authenticated;
