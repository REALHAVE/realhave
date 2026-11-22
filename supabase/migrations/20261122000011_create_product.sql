-- =====================================================================
-- 리얼해브 DB 11 : 상품등록 함수 (6단계)
--  - 사진 업로드가 끝난 뒤, 상품 + 사진 + 인증사진 + 색상 + 거래방식을
--    "한 번에" 저장 (중간에 실패하면 아무것도 저장되지 않음)
--  - security invoker: 등록하는 회원 본인의 권한(RLS)으로 실행
--    → 정상회원(이메일 인증 + 휴대폰번호)만 등록 가능, 심사상태는 자동으로 '심사대기'
-- 이 파일을 Supabase SQL Editor에서 1번 실행하세요.
-- =====================================================================

create or replace function public.create_product(
  p_id          uuid,
  p_title       text,
  p_brand_id    uuid,
  p_category_id uuid,
  p_place_code  text,
  p_size        text,
  p_grade       public.condition_grade,
  p_price       bigint,
  p_description text,
  p_image_paths text[],   -- product-images 버킷 경로, 순서대로 (첫 장 = 대표사진)
  p_cert        jsonb,    -- [{"path": "...", "kind": "tag|invoice|receipt"}, ...] (cert-docs 버킷)
  p_colors      text[],
  p_trades      text[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid    uuid := auth.uid();
  prefix text := uid::text || '/' || p_id::text || '/';
  n_img  int  := coalesce(array_length(p_image_paths, 1), 0);
  n_cert int  := coalesce(jsonb_array_length(p_cert), 0);
  path   text;
begin
  if uid is null then
    raise exception '로그인이 필요합니다';
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

  -- 사진은 본인 폴더의 "이 상품" 폴더에 실제로 올라가 있어야 함
  foreach path in array p_image_paths loop
    if left(path, length(prefix)) <> prefix
       or not exists (select 1 from storage.objects o
                      where o.bucket_id = 'product-images' and o.name = path) then
      raise exception '상품 사진 업로드를 확인해주세요';
    end if;
  end loop;
  for path in select c ->> 'path' from jsonb_array_elements(p_cert) c loop
    if path is null or left(path, length(prefix)) <> prefix
       or not exists (select 1 from storage.objects o
                      where o.bucket_id = 'cert-docs' and o.name = path) then
      raise exception '정품인증 사진 업로드를 확인해주세요';
    end if;
  end loop;

  insert into public.products (
    id, seller_id, title, brand_id, category_id, purchase_place_code,
    size, condition_grade, price, description
  ) values (
    p_id, uid, btrim(p_title), p_brand_id, p_category_id, p_place_code,
    nullif(p_size, ''), p_grade, p_price, coalesce(p_description, '')
  );

  insert into public.product_images (product_id, storage_path, sort_order)
  select p_id, t.path, t.ord - 1
  from unnest(p_image_paths) with ordinality as t(path, ord);

  insert into public.product_cert_images (product_id, kind, storage_path)
  select p_id, (c ->> 'kind')::public.cert_kind, c ->> 'path'
  from jsonb_array_elements(p_cert) c;

  insert into public.product_colors (product_id, color_code)
  select distinct p_id, x from unnest(coalesce(p_colors, '{}')) x;

  insert into public.product_trade_methods (product_id, trade_method_code)
  select distinct p_id, x from unnest(p_trades) x;

  return p_id;
end $$;

revoke all on function public.create_product(
  uuid, text, uuid, uuid, text, text, public.condition_grade, bigint, text, text[], jsonb, text[], text[]
) from public, anon;
grant execute on function public.create_product(
  uuid, text, uuid, uuid, text, text, public.condition_grade, bigint, text, text[], jsonb, text[], text[]
) to authenticated;
