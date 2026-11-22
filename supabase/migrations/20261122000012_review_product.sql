-- =====================================================================
-- 리얼해브 DB 12 : 정품인증 심사 (7단계)
--  - 상품관리 권한 관리자(master 또는 product)만 승인/반려 가능
--  - 승인: 상품 공개 + "최신등록상품" 맨 앞으로 (bumped_at = 지금)
--  - 반려: 사유 필수, 판매자에게 표시
--  - 심사 이력(auth_reviews)에 누가·언제·결과를 남김
--  ※ 인증서류 자동 가림(OCR)은 결정 14에 따라 나중에 연결.
--    연결 후에는 masking_status = 'failed' 인 상품의 승인을 막는 조건을 추가할 것.
-- 이 파일을 Supabase SQL Editor에서 1번 실행하세요.
-- =====================================================================

create or replace function public.review_product(
  p_product_id uuid,
  p_approve    boolean,
  p_reason     text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  prod   record;
  reason text := nullif(btrim(coalesce(p_reason, '')), '');
  rid    uuid;
begin
  if not private.is_admin('product') then
    raise exception '상품 심사 권한이 없습니다';
  end if;

  select id, status, auth_status into prod
  from public.products where id = p_product_id
  for update;

  if prod.id is null then
    raise exception '상품을 찾을 수 없습니다';
  end if;
  if prod.status <> 'on_sale' then
    raise exception '판매중인 상품만 심사할 수 있습니다';
  end if;
  if prod.auth_status <> 'pending' then
    raise exception '이미 심사가 끝난 상품입니다';
  end if;
  if not p_approve and (reason is null or char_length(reason) > 300) then
    raise exception '반려 사유를 1~300자로 입력해주세요';
  end if;

  perform private.trusted_on();
  update public.products
     set auth_status = case when p_approve then 'approved' else 'rejected' end::public.auth_status,
         bumped_at   = case when p_approve then now() else bumped_at end
   where id = p_product_id;
  perform private.trusted_off();

  -- 가장 최근 대기중 심사 이력에 결과 기록 (없으면 새로 만듦)
  select id into rid
  from public.auth_reviews
  where product_id = p_product_id and status in ('pending', 'needs_check')
  order by created_at desc
  limit 1;

  if rid is null then
    insert into public.auth_reviews (product_id, method, status)
    values (p_product_id, 'manual', 'pending')
    returning id into rid;
  end if;

  update public.auth_reviews
     set status        = case when p_approve then 'approved' else 'rejected' end::public.review_status,
         reviewer_id   = auth.uid(),
         reject_reason = case when p_approve then null else reason end,
         decided_at    = now()
   where id = rid;
end $$;

revoke all on function public.review_product(uuid, boolean, text) from public, anon;
grant execute on function public.review_product(uuid, boolean, text) to authenticated;
