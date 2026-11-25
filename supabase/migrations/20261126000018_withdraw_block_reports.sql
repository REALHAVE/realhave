-- =====================================================================
-- 리얼해브 DB 18 : 처리 중인 신고가 있으면 회원탈퇴 불가 (2026-11-26 요청)
--  탈퇴 가능 조건 = 판매중 상품 0개 (심사대기·반려 포함)
--                + 나와 관련된 "미처리" 신고 0건
--                  (내가 신고한 것 / 내가 신고당한 것 / 내가 참여한 대화가 신고된 것)
--  관리자가 신고를 '처리완료' 또는 '기각'으로 바꾸면 탈퇴할 수 있음
-- 이 파일을 Supabase SQL Editor에서 1번 실행하세요.
-- =====================================================================

-- 나와 관련된 미처리 신고 수
create or replace function private.open_reports_for(p_uid uuid)
returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int
  from public.reports r
  where r.status = 'open'
    and (r.reporter_id = p_uid
         or r.target_user_id = p_uid
         or r.target_room_id in (select c.id from public.chat_rooms c
                                 where p_uid in (c.seller_id, c.buyer_id)));
$$;
revoke execute on function private.open_reports_for(uuid) from public, anon, authenticated;

-- 탈퇴 화면에서 확인용: 판매중 상품 수 + 처리 중인 신고 수
create or replace function public.withdraw_status()
returns table (on_sale int, open_reports int)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*)::int from public.products p
      where p.seller_id = auth.uid() and p.status = 'on_sale'),
    private.open_reports_for(auth.uid());
$$;
revoke all on function public.withdraw_status() from public, anon;
grant execute on function public.withdraw_status() to authenticated;

-- 탈퇴 실행: 화면을 우회해도 DB에서 다시 막음
create or replace function public.withdraw_me()
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception '로그인이 필요합니다';
  end if;
  if exists (select 1 from public.products where seller_id = uid and status = 'on_sale') then
    raise exception '판매중인 상품을 먼저 삭제해주세요';
  end if;
  if private.open_reports_for(uid) > 0 then
    raise exception '처리 중인 신고가 있어 탈퇴할 수 없어요. 신고 처리가 끝난 뒤 다시 시도해주세요';
  end if;
  if exists (select 1 from public.admins where user_id = uid and role = 'master')
     and (select count(*) from public.admins where role = 'master') = 1 then
    raise exception '마지막 전체 관리자는 탈퇴할 수 없어요. 다른 전체 관리자를 먼저 지정해주세요';
  end if;
  perform private.purge_user(uid);
end $$;
revoke all on function public.withdraw_me() from public, anon;
grant execute on function public.withdraw_me() to authenticated;
