-- =====================================================================
-- 리얼해브 DB 17 : 신고 결과 안내 · 관리자 1:1 채팅
--  1) 신고자에게 보여줄 "처리 결과 안내" 칸 추가
--     + 관리자 내부 메모(admin_note)·증거는 신고자가 읽지 못하게 막음 (보안 보완)
--  2) 관리자 ↔ 회원 1:1 대화 (신고 대상 회원에게 관리자가 개입할 때)
--     거래 채팅과 별개. 해당 회원과 CS 관리자만 볼 수 있음
-- 이 파일을 Supabase SQL Editor에서 1번 실행하세요.
-- =====================================================================

-- 1) 신고 결과 안내 -------------------------------------------------------
alter table public.reports add column if not exists result_message text
  check (char_length(result_message) <= 1000);

-- 신고자(앱 사용자)가 읽을 수 있는 칸만 허용. 관리자 화면은 admin_reports() 함수로 전부 읽음
revoke select on public.reports from anon, authenticated;
grant select (id, reporter_id, target_type, target_product_id, target_user_id, target_room_id,
              reason, detail, status, result_message, created_at, handled_at)
  on public.reports to authenticated;

-- admin_reports 에 결과 안내 칸 추가
drop function if exists public.admin_reports();
create or replace function public.admin_reports()
returns table (
  id          uuid,
  target_type public.report_target,
  reason      public.report_reason,
  detail      text,
  status      public.report_status,
  admin_note  text,
  result_message text,
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
  select r.id, r.target_type, r.reason, r.detail, r.status, r.admin_note, r.result_message,
         r.created_at, r.handled_at,
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
revoke all on function public.admin_reports() from public, anon;
grant execute on function public.admin_reports() to authenticated;

-- 2) 관리자 1:1 대화 -----------------------------------------------------
create table if not exists public.support_threads (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles (id) on delete cascade,
  report_id            uuid references public.reports (id) on delete set null,
  subject              text not null default '리얼해브 관리자 안내',
  created_by           uuid references public.profiles (id) on delete set null,
  last_message_at      timestamptz,
  last_message_preview text,
  user_last_read_at    timestamptz,
  admin_last_read_at   timestamptz,
  created_at           timestamptz not null default now()
);
create index if not exists support_threads_user_idx on public.support_threads (user_id, last_message_at desc);

create table if not exists public.support_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.support_threads (id) on delete cascade,
  sender_id  uuid references public.profiles (id) on delete set null,
  is_admin   boolean not null default false,
  body       text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists support_messages_thread_idx on public.support_messages (thread_id, created_at);

alter table public.support_threads  enable row level security;
alter table public.support_messages enable row level security;

grant select on public.support_threads to authenticated;
grant select, insert on public.support_messages to authenticated;

create or replace function private.is_thread_user(tid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.support_threads t where t.id = tid and t.user_id = auth.uid());
$$;

create policy "support_threads: 본인·CS 조회" on public.support_threads
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin('cs'));

create policy "support_messages: 본인·CS 조회" on public.support_messages
  for select to authenticated
  using (private.is_thread_user(thread_id) or private.is_admin('cs'));
create policy "support_messages: 본인·CS 전송" on public.support_messages
  for insert to authenticated
  with check (sender_id = (select auth.uid())
              and (private.is_thread_user(thread_id) or private.is_admin('cs')));

-- 보낸 사람이 관리자인지는 DB가 정함 + 대화방 목록 정보 갱신
create or replace function private.support_messages_before()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.created_at := now();
  new.is_admin := not private.is_thread_user(new.thread_id) and private.is_admin('cs');
  new.body := btrim(new.body);
  return new;
end $$;
drop trigger if exists support_messages_before on public.support_messages;
create trigger support_messages_before before insert on public.support_messages
  for each row execute function private.support_messages_before();

create or replace function private.support_messages_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.support_threads
     set last_message_at      = new.created_at,
         last_message_preview = left(new.body, 100),
         admin_last_read_at   = case when new.is_admin then new.created_at else admin_last_read_at end,
         user_last_read_at    = case when new.is_admin then user_last_read_at else new.created_at end
   where id = new.thread_id;
  return null;
end $$;
drop trigger if exists support_messages_after on public.support_messages;
create trigger support_messages_after after insert on public.support_messages
  for each row execute function private.support_messages_after();

-- 관리자가 대화 시작 (같은 신고·같은 회원이면 기존 대화방)
create or replace function public.admin_open_thread(p_user_id uuid, p_report_id uuid default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  tid uuid;
begin
  if not private.is_admin('cs') then
    raise exception '신고/CS 권한이 없습니다';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception '회원을 찾을 수 없습니다';
  end if;
  select id into tid from public.support_threads
   where user_id = p_user_id and report_id is not distinct from p_report_id
   order by created_at desc limit 1;
  if tid is null then
    insert into public.support_threads (user_id, report_id, created_by, subject, user_last_read_at)
    values (p_user_id, p_report_id, auth.uid(),
            case when p_report_id is null then '리얼해브 관리자 안내' else '신고 관련 관리자 안내' end,
            now())
    returning id into tid;
  end if;
  return tid;
end $$;

-- 읽음 처리 (회원 또는 관리자)
create or replace function public.mark_thread_read(p_thread_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if private.is_thread_user(p_thread_id) then
    update public.support_threads set user_last_read_at = now() where id = p_thread_id;
  elsif private.is_admin('cs') then
    update public.support_threads set admin_last_read_at = now() where id = p_thread_id;
  end if;
end $$;

-- 회원: 내 관리자 대화 목록 (메시지가 있는 것만)
create or replace function public.my_support_threads()
returns table (thread_id uuid, subject text, last_message_at timestamptz, last_message text, unread int)
language sql stable security definer set search_path = '' as $$
  select t.id, t.subject, t.last_message_at, t.last_message_preview,
         (select count(*)::int from public.support_messages m
           where m.thread_id = t.id and m.is_admin
             and m.created_at > coalesce(t.user_last_read_at, '-infinity'::timestamptz))
  from public.support_threads t
  where t.user_id = auth.uid() and t.last_message_at is not null
  order by t.last_message_at desc;
$$;

-- 관리자: 전체 관리자 대화 목록
create or replace function public.admin_support_threads()
returns table (thread_id uuid, user_id uuid, nickname text, subject text, report_id uuid,
               last_message_at timestamptz, last_message text, unread int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin('cs') then
    raise exception '신고/CS 권한이 없습니다';
  end if;
  return query
  select t.id, t.user_id, p.nickname, t.subject, t.report_id, t.last_message_at, t.last_message_preview,
         (select count(*)::int from public.support_messages m
           where m.thread_id = t.id and not m.is_admin
             and m.created_at > coalesce(t.admin_last_read_at, '-infinity'::timestamptz))
  from public.support_threads t
  join public.profiles p on p.id = t.user_id
  order by coalesce(t.last_message_at, t.created_at) desc
  limit 300;
end $$;

revoke all on function public.admin_open_thread(uuid, uuid) from public, anon;
revoke all on function public.mark_thread_read(uuid)        from public, anon;
revoke all on function public.my_support_threads()          from public, anon;
revoke all on function public.admin_support_threads()       from public, anon;
grant execute on function public.admin_open_thread(uuid, uuid) to authenticated;
grant execute on function public.mark_thread_read(uuid)        to authenticated;
grant execute on function public.my_support_threads()          to authenticated;
grant execute on function public.admin_support_threads()       to authenticated;
grant execute on function private.is_thread_user(uuid)         to authenticated;

-- 실시간 (새 메시지를 화면에 바로)
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_messages') then
    alter publication supabase_realtime add table public.support_messages;
  end if;
end $$;
