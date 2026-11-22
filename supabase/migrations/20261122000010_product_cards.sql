-- =====================================================================
-- 리얼해브 DB 10 : 상품 목록·검색용 뷰 (5단계)
--  - 상품 카드에 필요한 정보(브랜드·카테고리·구매처·대표사진)를 한 번에 조회
--  - security_invoker: 보는 사람의 권한(RLS)이 그대로 적용됨
--    → 비회원에게는 승인된 상품만, 판매자 본인에게는 내 상품도 보임
-- 이 파일을 Supabase SQL Editor에서 1번 실행하세요.
-- =====================================================================

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
  (p.bumped_at > now() - interval '72 hours') as is_new,  -- 홈 카드 NEW 표시
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
  -- 검색용: 제목·브랜드(영문/한글)·카테고리를 소문자로 합친 글
  lower(concat_ws(' ', p.title, b.name_en, b.name_ko, c.name, top.name)) as search_text
from public.products p
join public.brands b           on b.id = p.brand_id
join public.categories c       on c.id = p.category_id
join public.categories top     on top.id = c.parent_id
join public.purchase_places pp on pp.code = p.purchase_place_code;

grant select on public.product_cards to anon, authenticated, service_role;
