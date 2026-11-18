-- =====================================================================
-- 리얼해브 DB 6/8 : RLS (행 단위 보안) — 모든 테이블
--   규칙이 없는 동작은 자동 차단됩니다.
-- =====================================================================

alter table public.profiles              enable row level security;
alter table public.user_private          enable row level security;
alter table public.admins                enable row level security;
alter table public.categories            enable row level security;
alter table public.brands                enable row level security;
alter table public.purchase_places       enable row level security;
alter table public.trade_methods         enable row level security;
alter table public.colors                enable row level security;
alter table public.products              enable row level security;
alter table public.auth_reviews          enable row level security;
alter table public.product_images        enable row level security;
alter table public.product_cert_images   enable row level security;
alter table public.product_trade_methods enable row level security;
alter table public.product_colors        enable row level security;
alter table public.wishlists             enable row level security;
alter table public.chat_rooms            enable row level security;
alter table public.messages              enable row level security;
alter table public.deals                 enable row level security;
alter table public.reports               enable row level security;
alter table public.inquiries             enable row level security;
alter table public.notices               enable row level security;

-- ---------- 회원 ----------
create policy "profiles: 누구나 조회" on public.profiles
  for select to anon, authenticated using (true);
create policy "profiles: 본인 또는 master 수정" on public.profiles
  for update to authenticated
  using      (id = (select auth.uid()) or private.is_admin('master'))
  with check (id = (select auth.uid()) or private.is_admin('master'));

create policy "user_private: 본인·CS 조회" on public.user_private
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin('cs'));
create policy "user_private: master 수정" on public.user_private
  for update to authenticated
  using (private.is_admin('master')) with check (private.is_admin('master'));

-- ---------- 관리자 ----------
create policy "admins: 본인·master 조회" on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin('master'));
create policy "admins: master 추가" on public.admins
  for insert to authenticated with check (private.is_admin('master'));
create policy "admins: master 수정 (자기 자신 제외)" on public.admins
  for update to authenticated
  using      (private.is_admin('master') and user_id <> (select auth.uid()))
  with check (private.is_admin('master') and user_id <> (select auth.uid()));
create policy "admins: master 삭제 (자기 자신 제외)" on public.admins
  for delete to authenticated
  using (private.is_admin('master') and user_id <> (select auth.uid()));

-- ---------- 기준 데이터 ----------
create policy "categories: 조회" on public.categories
  for select to anon, authenticated using (is_active or private.is_admin('product'));
create policy "categories: 상품관리자 관리" on public.categories
  for all to authenticated
  using (private.is_admin('product')) with check (private.is_admin('product'));

create policy "brands: 조회" on public.brands
  for select to anon, authenticated using (is_active or private.is_admin('product'));
create policy "brands: 상품관리자 관리" on public.brands
  for all to authenticated
  using (private.is_admin('product')) with check (private.is_admin('product'));

create policy "purchase_places: 조회" on public.purchase_places
  for select to anon, authenticated using (is_active or private.is_admin('product'));
create policy "purchase_places: 상품관리자 관리" on public.purchase_places
  for all to authenticated
  using (private.is_admin('product')) with check (private.is_admin('product'));

create policy "trade_methods: 조회" on public.trade_methods
  for select to anon, authenticated using (true);
create policy "trade_methods: 상품관리자 관리" on public.trade_methods
  for all to authenticated
  using (private.is_admin('product')) with check (private.is_admin('product'));

create policy "colors: 조회" on public.colors
  for select to anon, authenticated using (is_active or private.is_admin('product'));
create policy "colors: 상품관리자 관리" on public.colors
  for all to authenticated
  using (private.is_admin('product')) with check (private.is_admin('product'));

-- ---------- 상품 ----------
create policy "products: 공개·본인·상품관리자 조회" on public.products
  for select to anon, authenticated
  using (
    (auth_status = 'approved' and status in ('on_sale', 'sold')
      and exists (select 1 from public.profiles s where s.id = seller_id and s.status = 'active'))
    or seller_id = (select auth.uid())
    or private.is_admin('product')
  );
create policy "products: 활동회원 본인 등록" on public.products
  for insert to authenticated
  with check (seller_id = (select auth.uid()) and private.is_active_user());
create policy "products: 본인 수정 또는 상품관리자 숨김" on public.products
  for update to authenticated
  using      ((seller_id = (select auth.uid()) and private.is_active_user()) or private.is_admin('product'))
  with check ((seller_id = (select auth.uid()) and private.is_active_user()) or private.is_admin('product'));
-- 삭제 규칙 없음: 삭제는 status='deleted'로 표시

create policy "auth_reviews: 판매자·상품관리자 조회" on public.auth_reviews
  for select to authenticated
  using (
    exists (select 1 from public.products p where p.id = product_id and p.seller_id = (select auth.uid()))
    or private.is_admin('product')
  );
-- 추가/수정은 내부 함수만

create policy "product_images: 조회" on public.product_images
  for select to anon, authenticated using (private.can_view_product(product_id));
create policy "product_images: 판매자 등록" on public.product_images
  for insert to authenticated
  with check (private.owns_product(product_id) and private.is_active_user());
create policy "product_images: 판매자 순서변경" on public.product_images
  for update to authenticated
  using (private.owns_product(product_id)) with check (private.owns_product(product_id));
create policy "product_images: 판매자 삭제" on public.product_images
  for delete to authenticated using (private.owns_product(product_id));

create policy "product_cert_images: 판매자·상품관리자 조회" on public.product_cert_images
  for select to authenticated
  using (private.owns_product(product_id) or private.is_admin('product'));
create policy "product_cert_images: 판매자 등록" on public.product_cert_images
  for insert to authenticated
  with check (private.owns_product(product_id) and private.is_active_user());
create policy "product_cert_images: 판매자 삭제" on public.product_cert_images
  for delete to authenticated using (private.owns_product(product_id));
-- 수정(마스킹 결과 기록)은 서버만

create policy "product_trade_methods: 조회" on public.product_trade_methods
  for select to anon, authenticated using (private.can_view_product(product_id));
create policy "product_trade_methods: 판매자 선택" on public.product_trade_methods
  for insert to authenticated
  with check (private.owns_product(product_id) and private.is_active_user());
create policy "product_trade_methods: 판매자 해제" on public.product_trade_methods
  for delete to authenticated using (private.owns_product(product_id));

create policy "product_colors: 조회" on public.product_colors
  for select to anon, authenticated using (private.can_view_product(product_id));
create policy "product_colors: 판매자 선택" on public.product_colors
  for insert to authenticated
  with check (private.owns_product(product_id) and private.is_active_user());
create policy "product_colors: 판매자 해제" on public.product_colors
  for delete to authenticated using (private.owns_product(product_id));

-- ---------- 찜 ----------
create policy "wishlists: 본인 조회" on public.wishlists
  for select to authenticated using (user_id = (select auth.uid()));
create policy "wishlists: 본인 추가" on public.wishlists
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_active_user()
              and private.can_view_product(product_id));
create policy "wishlists: 본인 삭제" on public.wishlists
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------- 채팅 ----------
create policy "chat_rooms: 당사자 또는 신고된 방은 CS 조회" on public.chat_rooms
  for select to authenticated
  using (
    (select auth.uid()) in (seller_id, buyer_id)
    or (private.is_admin('cs') and private.is_reported_room(id))
  );
create policy "chat_rooms: 활동회원이 구매자로 개설" on public.chat_rooms
  for insert to authenticated
  with check (buyer_id = (select auth.uid()) and private.is_active_user());
-- 수정(읽음 처리)은 5단계 전용 함수로

create policy "messages: 당사자 또는 신고된 방은 CS 조회" on public.messages
  for select to authenticated
  using (
    private.is_room_participant(room_id)
    or (private.is_admin('cs') and private.is_reported_room(room_id))
  );
create policy "messages: 당사자 전송" on public.messages
  for insert to authenticated
  with check (sender_id = (select auth.uid()) and private.is_active_user()
              and private.is_room_participant(room_id));
-- 수정·삭제 없음

-- ---------- 거래 ----------
create policy "deals: 판매자·구매자·관리자 조회" on public.deals
  for select to authenticated
  using ((select auth.uid()) in (seller_id, buyer_id) or private.is_admin());
-- 생성은 거래완료 함수만

-- ---------- 신고 / 문의 / 공지 ----------
create policy "reports: 신고자·CS 조회" on public.reports
  for select to authenticated
  using (reporter_id = (select auth.uid()) or private.is_admin('cs'));
create policy "reports: 활동회원 신고" on public.reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()) and private.is_active_user());
create policy "reports: CS 처리" on public.reports
  for update to authenticated
  using (private.is_admin('cs')) with check (private.is_admin('cs'));

create policy "inquiries: 작성자·CS 조회" on public.inquiries
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin('cs'));
create policy "inquiries: 회원 작성" on public.inquiries
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "inquiries: CS 답변" on public.inquiries
  for update to authenticated
  using (private.is_admin('cs')) with check (private.is_admin('cs'));

create policy "notices: 게시글 조회" on public.notices
  for select to anon, authenticated using (is_published or private.is_admin('cs'));
create policy "notices: CS 관리" on public.notices
  for all to authenticated
  using (private.is_admin('cs')) with check (private.is_admin('cs'));
