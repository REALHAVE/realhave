-- =====================================================================
-- 리얼해브 1단계 점검용 (setup-all.sql 실행 후에 실행)
-- 아무것도 바꾸지 않고 "확인만" 합니다. 여러 번 실행해도 괜찮습니다.
-- 결과 표의 "결과" 칸이 모두 OK 이면 성공입니다.
-- =====================================================================
select '테이블 수 (21개여야 함)' as 항목,
       count(*)::text as 값,
       case when count(*) = 21 then 'OK' else '확인 필요' end as 결과
from pg_tables where schemaname = 'public'
union all
select 'RLS 꺼진 테이블 (0개여야 함)',
       count(*)::text,
       case when count(*) = 0 then 'OK' else '확인 필요' end
from pg_tables where schemaname = 'public' and not rowsecurity
union all
select '대분류 카테고리 (13개)',
       count(*)::text,
       case when count(*) = 13 then 'OK' else '확인 필요' end
from public.categories where parent_id is null
union all
select '구매처 (10개)', count(*)::text,
       case when count(*) = 10 then 'OK' else '확인 필요' end
from public.purchase_places
union all
select '거래방식 (3개)', count(*)::text,
       case when count(*) = 3 then 'OK' else '확인 필요' end
from public.trade_methods
union all
select '색상 (12개)', count(*)::text,
       case when count(*) = 12 then 'OK' else '확인 필요' end
from public.colors
union all
select '브랜드 (1개 이상)', count(*)::text,
       case when count(*) > 0 then 'OK' else '확인 필요' end
from public.brands
union all
select '사진 저장소 버킷 (4개)', count(*)::text,
       case when count(*) = 4 then 'OK' else '확인 필요' end
from storage.buckets
where id in ('product-images', 'cert-docs', 'cert-masked', 'chat-images');
