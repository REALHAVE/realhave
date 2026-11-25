-- =====================================================================
-- 리얼해브 DB 19 : 신고 처리 중인 상품은 판매자가 삭제할 수 없음 (2026-11-26 요청)
--  - 대상: 이 상품에 대한 "미처리" 신고 (상품 신고 + 이 상품으로 한 채팅 신고)
--  - 관리자가 신고를 처리완료·기각하면 다시 삭제 가능
--  - 관리자(상품관리)와 내부 처리(회원삭제 등)는 막지 않음
-- 이 파일을 Supabase SQL Editor에서 1번 실행하세요.
-- =====================================================================

create or replace function private.product_has_open_report(pid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.reports r
                  where r.target_product_id = pid and r.status = 'open');
$$;

-- 삭제(상태를 'deleted'로 바꾸기) 시도를 막는 검사
create or replace function private.products_block_delete_reported()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'deleted' and old.status <> 'deleted'
     and not private.is_trusted()
     and not private.is_admin('product')
     and private.product_has_open_report(old.id) then
    raise exception '신고 처리 중인 상품은 삭제할 수 없어요. 리얼해브 관리자의 확인이 끝난 뒤 삭제할 수 있어요';
  end if;
  return new;
end $$;

drop trigger if exists products_block_delete_reported on public.products;
create trigger products_block_delete_reported before update on public.products
  for each row execute function private.products_block_delete_reported();

-- 판매내역 화면에서 미리 경고를 띄우기 위한 목록 (내 상품 중 신고 처리 중인 것)
create or replace function public.my_reported_products()
returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct r.target_product_id
  from public.reports r
  join public.products p on p.id = r.target_product_id
  where r.status = 'open' and p.seller_id = auth.uid();
$$;

revoke execute on function private.product_has_open_report(uuid) from public, anon;
grant execute on function private.product_has_open_report(uuid) to authenticated;
revoke all on function public.my_reported_products() from public, anon;
grant execute on function public.my_reported_products() to authenticated;
