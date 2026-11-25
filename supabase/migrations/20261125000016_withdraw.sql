-- =====================================================================
-- 리얼해브 DB 16 : 신고 증거 보존 · 회원탈퇴 · 관리자 회원삭제 (11단계)
--  결정 8  : 탈퇴하면 대화·거래기록은 상대방 것까지 삭제
--  결정 15 (2026-11-25): 단, "처리중(미처리)" 신고와 관련된 대화는 증거로 남김
--           → 탈퇴 직전에 대화 내용을 신고 기록(reports.evidence)에 복사해 둠
-- 이 파일을 Supabase SQL Editor에서 1번 실행하세요.
-- =====================================================================

-- 1) 신고 기록이 회원탈퇴 때 같이 지워지지 않도록 --------------------------
alter table public.reports alter column reporter_id drop not null;
alter table public.reports drop constraint if exists reports_reporter_id_fkey;
alter table public.reports
  add constraint reports_reporter_id_fkey
  foreign key (reporter_id) references public.profiles (id) on delete set null;

-- 증거: 대화 사본 + 원래 채팅방 ID (채팅방이 지워져도 사진을 찾을 수 있게)
alter table public.reports add column if not exists evidence jsonb;
alter table public.reports add column if not exists evidence_room_id uuid;

-- 2) 증거 남기기: uid 가 관련된 "미처리" 신고의 대화를 복사 -----------------
create or replace function private.snapshot_report_evidence(p_uid uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  rep record;
  rid uuid;
begin
  for rep in
    select r.id, r.target_room_id, r.target_product_id, r.target_user_id
    from public.reports r
    where r.status = 'open'
      and r.evidence is null
      and (r.target_user_id = p_uid
           or r.reporter_id = p_uid
           or r.target_room_id in (select c.id from public.chat_rooms c
                                   where p_uid in (c.seller_id, c.buyer_id)))
  loop
    rid := rep.target_room_id;
    update public.reports
       set evidence_room_id = rid,
           evidence = jsonb_build_object(
             'saved_at', now(),
             'reason', '회원탈퇴로 원본이 삭제되어 보관한 사본',
             'withdrawn_user', (select nickname from public.profiles where id = p_uid),
             'product', (select jsonb_build_object('title', p.title, 'brand', b.name_en, 'price', p.price,
                                                   'seller', s.nickname)
                           from public.products p
                           join public.brands b on b.id = p.brand_id
                           join public.profiles s on s.id = p.seller_id
                          where p.id = rep.target_product_id),
             'target_user', (select nickname from public.profiles where id = rep.target_user_id),
             'messages', (select coalesce(jsonb_agg(jsonb_build_object(
                                   'sender', pr.nickname,
                                   'is_seller', m.sender_id = c.seller_id,
                                   'body', m.body,
                                   'image_path', m.image_path,
                                   'created_at', m.created_at) order by m.created_at), '[]'::jsonb)
                            from public.messages m
                            join public.chat_rooms c on c.id = m.room_id
                            left join public.profiles pr on pr.id = m.sender_id
                           where m.room_id = rid)
           )
     where id = rep.id;
  end loop;
end $$;

-- 3) 회원 완전 삭제 (공통) ----------------------------------------------
--  증거를 남긴 뒤 로그인 계정을 지우면, 연결된 회원정보·상품·찜·채팅·메시지·거래기록이
--  DB 규칙(on delete cascade)에 따라 함께 삭제됨
create or replace function private.purge_user(p_uid uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.snapshot_report_evidence(p_uid);
  perform private.trusted_on();   -- 신고 기록의 회원 칸을 비우는 작업 허용
  delete from auth.users where id = p_uid;
  perform private.trusted_off();
end $$;

-- 4) 회원탈퇴 (본인) -----------------------------------------------------
--  판매중 상품(심사대기·반려 포함)이 있으면 거절 — 먼저 판매내역에서 삭제해야 함
create or replace function public.withdraw_check()
returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.products
   where seller_id = auth.uid() and status = 'on_sale';
$$;

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
  if exists (select 1 from public.admins where user_id = uid and role = 'master')
     and (select count(*) from public.admins where role = 'master') = 1 then
    raise exception '마지막 전체 관리자는 탈퇴할 수 없어요. 다른 전체 관리자를 먼저 지정해주세요';
  end if;
  perform private.purge_user(uid);
end $$;

-- 5) 관리자 회원삭제 (master) ---------------------------------------------
create or replace function public.admin_delete_member(p_user_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin('master') then
    raise exception '전체 관리자만 회원을 삭제할 수 있습니다';
  end if;
  if p_user_id = auth.uid() then
    raise exception '본인 계정은 여기서 삭제할 수 없어요';
  end if;
  if p_user_id = 'a0000000-0000-4000-8000-000000000001' then
    raise exception '예시 판매자는 sample-data.sql 의 삭제 방법으로 지워주세요';
  end if;
  perform private.purge_user(p_user_id);
end $$;

-- 6) 신고 목록에 증거 포함 (admin_reports 다시 정의) ------------------------
drop function if exists public.admin_reports();
create or replace function public.admin_reports()
returns table (
  id          uuid,
  target_type public.report_target,
  reason      public.report_reason,
  detail      text,
  status      public.report_status,
  admin_note  text,
  created_at  timestamptz,
  handled_at  timestamptz,
  reporter    text,
  target_user text,
  target_user_id uuid,
  product_id  uuid,
  product     text,
  room_id     uuid,
  evidence    jsonb,
  evidence_room_id uuid
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin('cs') then
    raise exception '신고/CS 권한이 없습니다';
  end if;
  return query
  select r.id, r.target_type, r.reason, r.detail, r.status, r.admin_note, r.created_at, r.handled_at,
         coalesce(rp.nickname, '(탈퇴한 회원)'),
         coalesce(tu.nickname, r.evidence ->> 'target_user'),
         r.target_user_id, r.target_product_id,
         coalesce(case when p.id is null then null else b.name_en || ' ' || p.title end,
                  (r.evidence -> 'product' ->> 'brand') || ' ' || (r.evidence -> 'product' ->> 'title')),
         r.target_room_id, r.evidence, r.evidence_room_id
  from public.reports r
  left join public.profiles rp on rp.id = r.reporter_id
  left join public.profiles tu on tu.id = r.target_user_id
  left join public.products p on p.id = r.target_product_id
  left join public.brands b on b.id = p.brand_id
  order by (r.status = 'open') desc, r.created_at desc
  limit 300;
end $$;

-- 7) 증거로 남긴 채팅 사진은 CS 관리자가 볼 수 있게 ------------------------
create or replace function private.is_evidence_room(rid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.reports where evidence_room_id = rid);
$$;

drop policy if exists "realhave chat-images 증거 CS 조회" on storage.objects;
create policy "realhave chat-images 증거 CS 조회" on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-images'
         and private.is_admin('cs')
         and private.is_evidence_room(private.to_uuid((storage.foldername(name))[1])));

-- 8) 탈퇴 전 사진 정리: 내가 올린 상품사진·인증서류는 본인이 지울 수 있음(기존 규칙).
--    채팅 사진도 당사자가 지울 수 있게 (증거로 남긴 방은 제외)
drop policy if exists "realhave chat-images 당사자 삭제" on storage.objects;
create policy "realhave chat-images 당사자 삭제" on storage.objects
  for delete to authenticated
  using (bucket_id = 'chat-images'
         and private.is_room_participant(private.to_uuid((storage.foldername(name))[1]))
         and not private.is_reported_room(private.to_uuid((storage.foldername(name))[1])));

-- 권한
grant execute on function private.snapshot_report_evidence(uuid), private.purge_user(uuid),
                          private.is_evidence_room(uuid) to service_role;
revoke all on function public.withdraw_check()            from public, anon;
revoke all on function public.withdraw_me()               from public, anon;
revoke all on function public.admin_delete_member(uuid)   from public, anon;
revoke all on function public.admin_reports()             from public, anon;
grant execute on function public.withdraw_check()          to authenticated;
grant execute on function public.withdraw_me()             to authenticated;
grant execute on function public.admin_delete_member(uuid) to authenticated;
grant execute on function public.admin_reports()           to authenticated;
grant execute on function private.is_evidence_room(uuid)   to authenticated;
-- private 스키마 함수 중 purge 관련은 앱 사용자가 직접 호출 못 하게
revoke execute on function private.snapshot_report_evidence(uuid) from public, anon, authenticated;
revoke execute on function private.purge_user(uuid)               from public, anon, authenticated;
