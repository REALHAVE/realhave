-- =====================================================================
-- 리얼해브 DB 15 : 관리자 화면 (10단계)
--  모든 함수는 시작할 때 관리자 권한을 확인함 (권한 없으면 오류)
--  - 대시보드 숫자
--  - 회원 목록(이메일·휴대폰은 master·cs만) / 자격중지·허용 (master)
--  - 거래 현황 (채팅 내용은 보여주지 않음 — 결정 9)
--  - 신고 목록 (대상 상품·회원 이름 포함)
--  - 관리자 목록·추가·권한 변경·해제 (master, 자기 자신은 변경 불가)
-- 이 파일을 Supabase SQL Editor에서 1번 실행하세요.
-- =====================================================================

-- 1) 대시보드 ------------------------------------------------------------
create or replace function public.admin_dashboard()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  today_kst date := (now() at time zone 'Asia/Seoul')::date;
  result jsonb;
begin
  if not private.is_admin() then
    raise exception '관리자만 볼 수 있습니다';
  end if;

  select jsonb_build_object(
    'today_products', (select count(*) from public.products
                        where (created_at at time zone 'Asia/Seoul')::date = today_kst),
    'today_signups',  (select count(*) from public.profiles
                        where (created_at at time zone 'Asia/Seoul')::date = today_kst),
    'pending',        (select count(*) from public.products
                        where auth_status = 'pending' and status = 'on_sale'),
    'pending_over24', (select count(*) from public.products
                        where auth_status = 'pending' and status = 'on_sale'
                          and created_at < now() - interval '24 hours'),
    'open_reports',   (select count(*) from public.reports where status = 'open'),
    'waiting_inquiries', (select count(*) from public.inquiries where status = 'waiting'),
    'members',        (select count(*) from public.profiles),
    'on_sale',        (select count(*) from public.products
                        where status = 'on_sale' and auth_status = 'approved'),
    'weekly', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d, 'count', c) order by d), '[]'::jsonb)
      from (
        select g::date as d,
               (select count(*) from public.products p
                 where (p.created_at at time zone 'Asia/Seoul')::date = g::date) as c
        from generate_series(today_kst - 6, today_kst, interval '1 day') g
      ) w
    ),
    'recent_deals', (
      select coalesce(jsonb_agg(x order by x->>'completed_at' desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
                 'product', b.name_en || ' ' || p.title,
                 'buyer',   bu.nickname,
                 'seller',  se.nickname,
                 'method',  tm.name,
                 'price',   d.price,
                 'completed_at', d.completed_at) as x
        from public.deals d
        join public.products p   on p.id = d.product_id
        join public.brands b     on b.id = p.brand_id
        join public.profiles se  on se.id = d.seller_id
        left join public.profiles bu on bu.id = d.buyer_id
        left join public.trade_methods tm on tm.code = d.trade_method_code
        order by d.completed_at desc
        limit 5
      ) r
    )
  ) into result;
  return result;
end $$;

-- 2) 회원 목록 -----------------------------------------------------------
create or replace function public.admin_members(p_query text default null)
returns table (
  id               uuid,
  nickname         text,
  email            text,
  phone            text,
  status           public.user_status,
  suspended_reason text,
  created_at       timestamptz,
  last_sign_in_at  timestamptz,
  email_confirmed  boolean,
  on_sale_count    int,
  sold_count       int,
  purchase_count   int,
  admin_role       public.admin_role
)
language plpgsql stable security definer set search_path = '' as $$
declare
  q text := nullif(btrim(coalesce(p_query, '')), '');
begin
  if not (private.is_admin('master') or private.is_admin('cs')) then
    raise exception '회원 관리 권한이 없습니다';
  end if;

  return query
  select
    p.id, p.nickname, u.email::text, up.phone, p.status, up.suspended_reason,
    p.created_at, u.last_sign_in_at, u.email_confirmed_at is not null,
    (select count(*)::int from public.products x where x.seller_id = p.id and x.status = 'on_sale'),
    (select count(*)::int from public.products x where x.seller_id = p.id and x.status = 'sold'),
    (select count(*)::int from public.deals d where d.buyer_id = p.id),
    a.role
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.user_private up on up.user_id = p.id
  left join public.admins a on a.user_id = p.id
  where p.id <> 'a0000000-0000-4000-8000-000000000001'  -- 예시 판매자 제외
    and (q is null
         or p.nickname ilike '%' || q || '%'
         or u.email ilike '%' || q || '%'
         or (length(regexp_replace(q, '[^0-9]', '', 'g')) >= 4
             and up.phone like '%' || regexp_replace(q, '[^0-9]', '', 'g') || '%'))
  order by p.created_at desc
  limit 300;
end $$;

-- 3) 자격중지 / 허용 (master) -------------------------------------------
create or replace function public.admin_set_member_status(
  p_user_id uuid,
  p_suspend boolean,
  p_reason  text default null
)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin('master') then
    raise exception '전체 관리자만 회원 상태를 바꿀 수 있습니다';
  end if;
  if p_user_id = auth.uid() then
    raise exception '본인 계정은 바꿀 수 없습니다';
  end if;
  if p_suspend and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception '자격중지 사유를 입력해주세요';
  end if;

  perform private.trusted_on();
  update public.profiles
     set status = case when p_suspend then 'suspended' else 'active' end::public.user_status
   where id = p_user_id;
  update public.user_private
     set suspended_reason = case when p_suspend then left(btrim(p_reason), 300) else null end
   where user_id = p_user_id;
  perform private.trusted_off();
end $$;

-- 4) 거래 현황 (채팅방 단위, 메시지 내용 없음) ----------------------------
create or replace function public.admin_deal_overview()
returns table (
  room_id         uuid,
  product_id      uuid,
  product         text,
  price           bigint,
  buyer           text,
  seller          text,
  last_message_at timestamptz,
  state           text,     -- chatting / done / done_other / done_no_buyer / closed
  method          text,
  reported        boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception '관리자만 볼 수 있습니다';
  end if;

  return query
  -- 채팅방 (진행중·완료)
  select
    r.id, p.id, b.name_en || ' ' || p.title, p.price, bu.nickname, se.nickname,
    r.last_message_at,
    case
      when p.status = 'on_sale' then 'chatting'
      when d.buyer_id = r.buyer_id then 'done'
      when d.buyer_id is null and p.status = 'sold' then 'done_no_buyer'
      when p.status = 'sold' then 'done_other'
      else 'closed'
    end,
    tm.name,
    exists (select 1 from public.reports rp where rp.target_room_id = r.id)
  from public.chat_rooms r
  join public.products p  on p.id = r.product_id
  join public.brands b    on b.id = p.brand_id
  join public.profiles bu on bu.id = r.buyer_id
  join public.profiles se on se.id = r.seller_id
  left join public.deals d on d.product_id = p.id
  left join public.trade_methods tm on tm.code = d.trade_method_code
  where r.last_message_at is not null
  union all
  -- 채팅 없이 거래완료된 상품 ("선택하지 않을래요")
  select
    null, p.id, b.name_en || ' ' || p.title, d.price, null, se.nickname,
    d.completed_at, 'done_no_buyer', tm.name, false
  from public.deals d
  join public.products p  on p.id = d.product_id
  join public.brands b    on b.id = p.brand_id
  join public.profiles se on se.id = d.seller_id
  left join public.trade_methods tm on tm.code = d.trade_method_code
  where d.buyer_id is null
    and not exists (select 1 from public.chat_rooms r
                    where r.product_id = p.id and r.last_message_at is not null)
  order by 7 desc nulls last
  limit 300;
end $$;

-- 5) 신고 목록 (cs) ------------------------------------------------------
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
  room_id     uuid
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin('cs') then
    raise exception '신고/CS 권한이 없습니다';
  end if;
  return query
  select r.id, r.target_type, r.reason, r.detail, r.status, r.admin_note, r.created_at, r.handled_at,
         rp.nickname, tu.nickname, r.target_user_id, r.target_product_id,
         case when p.id is null then null else b.name_en || ' ' || p.title end,
         r.target_room_id
  from public.reports r
  join public.profiles rp on rp.id = r.reporter_id
  left join public.profiles tu on tu.id = r.target_user_id
  left join public.products p on p.id = r.target_product_id
  left join public.brands b on b.id = p.brand_id
  order by (r.status = 'open') desc, r.created_at desc
  limit 300;
end $$;

-- 6) 관리자 계정 (master) ------------------------------------------------
create or replace function public.admin_list_admins()
returns table (
  user_id         uuid,
  nickname        text,
  email           text,
  role            public.admin_role,
  last_sign_in_at timestamptz,
  created_at      timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin('master') then
    raise exception '전체 관리자만 볼 수 있습니다';
  end if;
  return query
  select a.user_id, p.nickname, u.email::text, a.role, u.last_sign_in_at, a.created_at
  from public.admins a
  join public.profiles p on p.id = a.user_id
  join auth.users u on u.id = a.user_id
  order by a.created_at;
end $$;

-- 이메일로 관리자 추가 / 권한 변경 (가입된 회원만)
create or replace function public.admin_set_admin(p_email text, p_role public.admin_role)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid;
begin
  if not private.is_admin('master') then
    raise exception '전체 관리자만 관리자를 지정할 수 있습니다';
  end if;
  select id into uid from auth.users where lower(email) = lower(btrim(p_email));
  if uid is null then
    raise exception '그 이메일로 가입한 회원이 없습니다. 먼저 리얼해브에 가입해야 해요';
  end if;
  if uid = auth.uid() then
    raise exception '본인 권한은 바꿀 수 없습니다';
  end if;
  insert into public.admins (user_id, role, created_by)
  values (uid, p_role, auth.uid())
  on conflict (user_id) do update set role = excluded.role;
end $$;

create or replace function public.admin_remove_admin(p_user_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin('master') then
    raise exception '전체 관리자만 관리자를 해제할 수 있습니다';
  end if;
  if p_user_id = auth.uid() then
    raise exception '본인은 해제할 수 없습니다';
  end if;
  delete from public.admins where user_id = p_user_id;
end $$;

-- 7) 카테고리·브랜드별 상품 수 (상품관리) ---------------------------------
create or replace function public.admin_catalog_counts()
returns table (kind text, id uuid, cnt int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin('product') then
    raise exception '상품 관리 권한이 없습니다';
  end if;
  return query
  select 'brand', p.brand_id, count(*)::int from public.products p
   where p.status <> 'deleted' group by p.brand_id
  union all
  select 'category', c.parent_id, count(*)::int from public.products p
    join public.categories c on c.id = p.category_id
   where p.status <> 'deleted' group by c.parent_id
  union all
  select 'category', p.category_id, count(*)::int from public.products p
   where p.status <> 'deleted' group by p.category_id;
end $$;

-- 권한: 로그인 회원만 호출 가능 (함수 안에서 관리자인지 다시 확인)
do $$
declare
  f text;
begin
  foreach f in array array[
    'admin_dashboard()',
    'admin_members(text)',
    'admin_set_member_status(uuid, boolean, text)',
    'admin_deal_overview()',
    'admin_reports()',
    'admin_list_admins()',
    'admin_set_admin(text, public.admin_role)',
    'admin_remove_admin(uuid)',
    'admin_catalog_counts()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
