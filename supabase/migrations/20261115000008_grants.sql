-- =====================================================================
-- 리얼해브 DB 8/8 : API 접근 권한 명시
--   Supabase 프로젝트 설정과 관계없이 동일하게 동작하도록 권한을 직접 지정.
--   실제로 무엇을 볼 수 있는지는 6번 파일의 RLS 규칙이 결정합니다.
-- =====================================================================

-- 비회원: 조회만
grant select on all tables in schema public to anon;
-- 회원: 조회·추가·수정·삭제 (행 단위 허용 여부는 RLS가 판단)
grant select, insert, update, delete on all tables in schema public to authenticated;
-- 서버(service_role)
grant all on all tables in schema public to service_role;

-- 권한 판단 함수 실행 권한
grant execute on all functions in schema private to anon, authenticated, service_role;

-- 가린 인증사진 목록 함수는 로그인 회원만
revoke execute on function public.get_masked_cert_images(uuid) from public, anon;
grant  execute on function public.get_masked_cert_images(uuid) to authenticated;
