-- =====================================================================
-- 리얼해브 DB 20 (2026-11-28 요청)
--  1) 신고 처리 중인 상품은 판매자가 수정할 수 없음 (내용·사진·인증사진·색상·거래방식)
--  2) 회원탈퇴·회원삭제 시 거래완료 상품도 함께 삭제하되,
--     전자상거래법 제6조·시행령 제6조 제1항에 따라 관리자 전용 "법정 보관함"에 사본 보관
--       - 계약·청약철회 / 대금결제·재화 공급 기록 : 5년  → kind 'contract'
--       - 소비자 불만·분쟁처리 기록               : 3년  → kind 'dispute'
--       - 표시·광고 기록                          : 6개월 → kind 'ad'
--     ※ 리얼해브는 결제를 다루지 않으므로 거래완료 기록(가격·거래방식·당사자)을 5년 보관
--     ※ 보관함은 전체 관리자(master)만 함수로 볼 수 있음. 회원·다른 관리자는 직접 조회 불가
-- 이 파일을 Supabase SQL Editor에서 1번 실행하세요.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) 신고 처리 중인 상품 수정 금지
-- ---------------------------------------------------------------------
create or replace function private.products_block_reported_changes()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.is_trusted() or private.is_admin('product') then
    return new;
  end if;
  if not private.product_has_open_report(old.id) then
    return new;
  end if;
  -- 삭제 시도
  if new.status = 'deleted' and old.status <> 'deleted' then
    raise exception '신고 처리 중인 상품은 삭제할 수 없어요. 리얼해브 관리자의 확인이 끝난 뒤 삭제할 수 있어요';
  end if;
  -- 내용 수정 시도
  if (new.title, new.brand_id, new.category_id, new.purchase_place_code, new.size,
      new.condition_grade, new.price, new.description)
     is distinct from
     (old.title, old.brand_id, old.category_id, old.purchase_place_code, old.size,
      old.condition_grade, old.price, old.description) then
    raise exception '신고 처리 중인 상품은 수정할 수 없어요. 리얼해브 관리자의 확인이 끝난 뒤 수정할 수 있어요';
  end if;
  return new;
end $$;

-- 기존 '삭제만 막는' 검사를 이 검사로 교체
drop trigger if exists products_block_delete_reported on public.products;
drop trigger if exists products_block_reported_changes on public.products;
create trigger products_block_reported_changes before update on public.products
  for each row execute function private.products_block_reported_changes();

-- 사진·인증사진·색상·거래방식 바꾸기도 막음
create or replace function private.product_children_block_reported()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  pid uuid := coalesce(new.product_id, old.product_id);
begin
  if private.is_trusted() or private.is_admin('product') then
    return coalesce(new, old);
  end if;
  if private.product_has_open_report(pid) then
    raise exception '신고 처리 중인 상품은 수정할 수 없어요. 리얼해브 관리자의 확인이 끝난 뒤 수정할 수 있어요';
  end if;
  return coalesce(new, old);
end $$;

do $$
declare
  t text;
begin
  foreach t in array array['product_images', 'product_cert_images', 'product_colors', 'product_trade_methods'] loop
    execute format('drop trigger if exists %1$s_block_reported on public.%1$s', t);
    execute format(
      'create trigger %1$s_block_reported before insert or update or delete on public.%1$s
         for each row execute function private.product_children_block_reported()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2) 법정 보관함
-- ---------------------------------------------------------------------
create table if not exists public.legal_records (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('contract', 'dispute', 'ad')),
  subject_user  uuid,          -- 탈퇴한 회원 ID (원래 계정은 삭제되어 연결 없음)
  subject_name  text,          -- 탈퇴 당시 닉네임
  source_table  text not null, -- deals / inquiries / reports / support_threads / products
  source_id     uuid,
  data          jsonb not null,
  recorded_at   timestamptz not null default now(),
  retain_until  timestamptz not null,
  reason        text not null default '회원탈퇴'
);
create index if not exists legal_records_until_idx on public.legal_records (retain_until);
create index if not exists legal_records_kind_idx  on public.legal_records (kind, recorded_at desc);
create unique index if not exists legal_records_source_uniq on public.legal_records (kind, source_table, source_id);

-- 아무도 직접 읽거나 쓸 수 없음 (정책 없음 = 전부 차단). 관리자 함수로만 접근
alter table public.legal_records enable row level security;
revoke all on public.legal_records from anon, authenticated;

-- 당사자 정보 (닉네임·이메일·휴대폰) — 법정 보관용
create or replace function private.person_json(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('nickname', p.nickname, 'email', u.email, 'phone', up.phone)
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.user_private up on up.user_id = p.id
  where p.id = p_id;
$$;
revoke execute on function private.person_json(uuid) from public, anon, authenticated;

-- 회원 1명의 법정 보관 대상 기록을 보관함에 복사
create or replace function private.archive_user_records(p_uid uuid, p_reason text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  nick text := (select nickname from public.profiles where id = p_uid);
begin
  -- (1) 계약·재화 공급 기록 — 거래완료 시점부터 5년
  insert into public.legal_records (kind, subject_user, subject_name, source_table, source_id, data, retain_until, reason)
  select 'contract', p_uid, nick, 'deals', d.id,
         jsonb_build_object(
           'completed_at', d.completed_at,
           'price', d.price,
           'trade_method', tm.name,
           'product', jsonb_build_object(
              'id', p.id, 'title', p.title, 'brand', b.name_en,
              'category', top.name || ' > ' || c.name, 'purchase_place', pp.name,
              'size', p.size, 'condition', p.condition_grade, 'listed_price', p.price,
              'created_at', p.created_at),
           'seller', private.person_json(d.seller_id),
           'buyer',  private.person_json(d.buyer_id)),
         d.completed_at + interval '5 years', p_reason
  from public.deals d
  join public.products p on p.id = d.product_id
  join public.brands b on b.id = p.brand_id
  join public.categories c on c.id = p.category_id
  join public.categories top on top.id = c.parent_id
  join public.purchase_places pp on pp.code = p.purchase_place_code
  left join public.trade_methods tm on tm.code = d.trade_method_code
  where p_uid in (d.seller_id, d.buyer_id)
  on conflict (kind, source_table, source_id) do nothing;

  -- (2) 소비자 불만·분쟁처리 기록 — 접수 시점부터 3년
  --  1:1 문의
  insert into public.legal_records (kind, subject_user, subject_name, source_table, source_id, data, retain_until, reason)
  select 'dispute', p_uid, nick, 'inquiries', q.id,
         jsonb_build_object('title', q.title, 'body', q.body, 'status', q.status, 'answer', q.answer,
                            'created_at', q.created_at, 'answered_at', q.answered_at,
                            'writer', private.person_json(p_uid)),
         q.created_at + interval '3 years', p_reason
  from public.inquiries q
  where q.user_id = p_uid
  on conflict (kind, source_table, source_id) do nothing;

  --  신고 (신고 기록 자체는 남지만 회원 연결이 끊기므로 당시 이름을 함께 보관)
  insert into public.legal_records (kind, subject_user, subject_name, source_table, source_id, data, retain_until, reason)
  select 'dispute', p_uid, nick, 'reports', r.id,
         jsonb_build_object('target_type', r.target_type, 'reason', r.reason, 'detail', r.detail,
                            'status', r.status, 'result_message', r.result_message, 'admin_note', r.admin_note,
                            'created_at', r.created_at, 'handled_at', r.handled_at,
                            'reporter', (select nickname from public.profiles where id = r.reporter_id),
                            'target_user', (select nickname from public.profiles where id = r.target_user_id),
                            'product', (select b.name_en || ' ' || p.title from public.products p
                                          join public.brands b on b.id = p.brand_id where p.id = r.target_product_id),
                            'evidence', r.evidence),
         r.created_at + interval '3 years', p_reason
  from public.reports r
  where r.reporter_id = p_uid or r.target_user_id = p_uid
     or r.target_room_id in (select c.id from public.chat_rooms c where p_uid in (c.seller_id, c.buyer_id))
  on conflict (kind, source_table, source_id) do nothing;

  --  관리자 1:1 대화
  insert into public.legal_records (kind, subject_user, subject_name, source_table, source_id, data, retain_until, reason)
  select 'dispute', p_uid, nick, 'support_threads', t.id,
         jsonb_build_object('subject', t.subject, 'created_at', t.created_at,
                            'messages', (select coalesce(jsonb_agg(jsonb_build_object(
                                            'is_admin', m.is_admin, 'body', m.body, 'created_at', m.created_at)
                                            order by m.created_at), '[]'::jsonb)
                                         from public.support_messages m where m.thread_id = t.id)),
         t.created_at + interval '3 years', p_reason
  from public.support_threads t
  where t.user_id = p_uid
  on conflict (kind, source_table, source_id) do nothing;

  -- (3) 표시·광고 기록 — 탈퇴(게시 종료) 시점부터 6개월. 상품 글과 사진 경로
  insert into public.legal_records (kind, subject_user, subject_name, source_table, source_id, data, retain_until, reason)
  select 'ad', p_uid, nick, 'products', p.id,
         jsonb_build_object(
           'title', p.title, 'brand', b.name_en, 'category', top.name || ' > ' || c.name,
           'purchase_place', pp.name, 'size', p.size, 'condition', p.condition_grade,
           'price', p.price, 'description', p.description, 'status', p.status,
           'auth_status', p.auth_status, 'created_at', p.created_at, 'sold_at', p.sold_at,
           'deleted_at', p.deleted_at,
           'colors', (select coalesce(jsonb_agg(co.name), '[]'::jsonb) from public.product_colors pc
                       join public.colors co on co.code = pc.color_code where pc.product_id = p.id),
           'trade_methods', (select coalesce(jsonb_agg(t.name), '[]'::jsonb) from public.product_trade_methods pt
                              join public.trade_methods t on t.code = pt.trade_method_code where pt.product_id = p.id),
           'image_paths', (select coalesce(jsonb_agg(i.storage_path order by i.sort_order), '[]'::jsonb)
                            from public.product_images i where i.product_id = p.id)),
         now() + interval '6 months', p_reason
  from public.products p
  join public.brands b on b.id = p.brand_id
  join public.categories c on c.id = p.category_id
  join public.categories top on top.id = c.parent_id
  join public.purchase_places pp on pp.code = p.purchase_place_code
  where p.seller_id = p_uid
  on conflict (kind, source_table, source_id) do nothing;
end $$;
revoke execute on function private.archive_user_records(uuid, text) from public, anon, authenticated;

-- 회원 완전 삭제: 증거 보관 → 법정 보관 → 계정 삭제 (거래완료 상품 포함 전부 삭제)
create or replace function private.purge_user(p_uid uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.snapshot_report_evidence(p_uid);
  perform private.archive_user_records(
    p_uid,
    case when p_uid = auth.uid() then '회원탈퇴' else '관리자 회원삭제' end);
  perform private.trusted_on();
  delete from auth.users where id = p_uid;
  perform private.trusted_off();
end $$;
revoke execute on function private.purge_user(uuid) from public, anon, authenticated;

-- 상품사진은 6개월 보관 후 관리자가 지울 수 있어야 하므로 전체 관리자 삭제 허용
drop policy if exists "realhave product-images master 삭제" on storage.objects;
create policy "realhave product-images master 삭제" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and private.is_admin('master'));

-- ---------------------------------------------------------------------
-- 3) 관리자 화면용 (master 전용)
-- ---------------------------------------------------------------------
create or replace function public.admin_legal_records(p_kind text default null)
returns table (id uuid, kind text, subject_name text, source_table text, data jsonb,
               recorded_at timestamptz, retain_until timestamptz, reason text, expired boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin('master') then
    raise exception '전체 관리자만 볼 수 있습니다';
  end if;
  return query
  select l.id, l.kind, l.subject_name, l.source_table, l.data, l.recorded_at, l.retain_until, l.reason,
         l.retain_until < now()
  from public.legal_records l
  where p_kind is null or l.kind = p_kind
  order by l.recorded_at desc
  limit 500;
end $$;

-- 보존기간이 지난 기록 파기. 지울 상품사진 경로를 돌려줌 (화면에서 저장소 파일 삭제)
create or replace function public.admin_purge_expired_records()
returns table (deleted int, image_paths text[])
language plpgsql security definer set search_path = '' as $$
declare
  paths text[];
  n int;
begin
  if not private.is_admin('master') then
    raise exception '전체 관리자만 파기할 수 있습니다';
  end if;
  select coalesce(array_agg(distinct x), '{}') into paths
  from public.legal_records l,
       jsonb_array_elements_text(coalesce(l.data -> 'image_paths', '[]'::jsonb)) x
  where l.kind = 'ad' and l.retain_until < now()
    -- 아직 살아있는 상품이 같은 사진을 쓰면 지우지 않음
    and not exists (select 1 from public.product_images i where i.storage_path = x);

  delete from public.legal_records where retain_until < now();
  get diagnostics n = row_count;
  return query select n, paths;
end $$;

revoke all on function public.admin_legal_records(text)       from public, anon;
revoke all on function public.admin_purge_expired_records()   from public, anon;
grant execute on function public.admin_legal_records(text)     to authenticated;
grant execute on function public.admin_purge_expired_records() to authenticated;
