-- =====================================================================
-- 리얼해브 예시 상품 (화면 확인용)
--  - "리얼해브샘플" 이라는 예시 판매자 계정 1개 + 승인된 예시 상품 12개
--  - 사진은 없음 (회색 자리로 표시됨)
--  - 지우고 싶으면 맨 아래 "예시 데이터 삭제" 부분만 실행
-- Supabase SQL Editor에서 1번 실행하세요. (두 번 실행해도 중복으로 들어가지 않음)
-- =====================================================================

-- 1) 예시 판매자 계정 (로그인 불가능한 임의 비밀번호, 존재하지 않는 이메일)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  'a0000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated',
  'sample-seller@realhave.invalid',
  extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"nickname":"리얼해브샘플","phone":"01000000000","agreed_terms":"true","agreed_privacy":"true"}',
  now(), now(), '', '', '', ''
)
on conflict (id) do nothing;

-- 2) 예시 상품
with s(title, brand, top_cat, sub_cat, place, size, grade, price, descr, colors, trades, hours_ago) as (
  values
    ('버킨백 30 토고 블랙 골드하드웨어', 'HERMÈS', '가방/핸드백', '토트백/버킷백', 'dom_h_dept', null, 'A+', 18900000,
     '사용감 적은 상태입니다. 더스트백, 보증서 포함되어 있고 백화점에서 2023년 5월 구입했어요. 직거래 선호합니다 :)',
     array['black'], array['direct','parcel'], 1),
    ('버킨백 25 에프수아 그레이', 'HERMÈS', '가방/핸드백', '토트백/버킷백', 'ovs_dutyfree', null, 'NEW', 22400000,
     '새상품입니다. 구성품 모두 있습니다.', array['gray'], array['direct'], 3),
    ('여성 숄더백', 'HERMÈS', '가방/핸드백', '숄더백/체인백', 'dom_s_dept', null, 'A', 9990000,
     '모서리 약간의 사용감 있습니다.', array['brown'], array['direct','parcel'], 5),
    ('구찌지 카드지갑', 'GUCCI', '지갑/벨트', '카드지갑/코인케이스', 'dom_l_dept', null, 'NEW', 1990000,
     '선물 받고 한 번도 사용하지 않았습니다.', array['black','red'], array['parcel','half_parcel'], 2),
    ('마몬트 크로스백', 'GUCCI', '가방/핸드백', '여성크로스백', 'dom_dutyfree', null, 'NEW', 1900000,
     '면세점 구입, 영수증 있습니다.', array['pink'], array['direct','parcel'], 7),
    ('여성 셀렉티드 로퍼', 'LORO PIANA', '여성슈즈', '로퍼', 'ovs_dutyfree', '245', 'A', 780000,
     '3~4회 착용했습니다. 밑창 상태 좋아요.', array['navy'], array['parcel'], 4),
    ('캐시미어 니트 가디건', 'LORO PIANA', '여성의류', '니트/가디건', 'dom_h_dept', '55', 'A+', 1450000,
     '드라이클리닝 완료했습니다.', array['white'], array['parcel','half_parcel'], 9),
    ('숄더백', 'CASIMA', '가방/핸드백', '숄더백/체인백', 'dom_roadshop', null, 'B+', 590000,
     '생활 기스 있습니다. 사진 참고 부탁드려요.', array['black'], array['direct'], 6),
    ('클래식 플랩백 미디움 캐비어', 'CHANEL', '가방/핸드백', '숄더백/체인백', 'dom_s_dept', null, 'A', 13500000,
     '보증서, 카드 모두 있습니다.', array['black'], array['direct'], 12),
    ('서브마리너 데이트 41mm', 'ROLEX', '시계', '남성시계', 'dom_h_dept', null, 'A+', 17800000,
     '2024년 구입, 풀구성입니다.', array['black','green'], array['direct'], 20),
    ('T 스마일 펜던트 목걸이', 'TIFFANY & CO.', '주얼리', '목걸이/펜던트', 'dom_l_dept', null, 'NEW', 1250000,
     '미착용 새상품입니다.', array['yellow'], array['parcel'], 26),
    ('베오플레이 H95 헤드폰', 'BANG & OLUFSEN', '가전', '헤드폰', 'dom_etc', null, 'A', 790000,
     '박스 포함 풀구성, 정상 작동합니다.', array['brown'], array['parcel','half_parcel'], 30)
),
ins as (
  insert into public.products (
    seller_id, title, brand_id, category_id, purchase_place_code, size,
    condition_grade, price, description, status, auth_status, bumped_at, created_at
  )
  select
    'a0000000-0000-4000-8000-000000000001',
    s.title,
    b.id,
    c.id,
    s.place,
    s.size,
    s.grade::public.condition_grade,
    s.price,
    s.descr,
    'on_sale',
    'approved',
    now() - make_interval(hours => s.hours_ago),
    now() - make_interval(hours => s.hours_ago)
  from s
  join public.brands b      on b.name_en = s.brand
  join public.categories t  on t.name = s.top_cat and t.parent_id is null
  join public.categories c  on c.name = s.sub_cat and c.parent_id = t.id
  where not exists (
    select 1 from public.products p
    where p.seller_id = 'a0000000-0000-4000-8000-000000000001' and p.title = s.title
  )
  returning id, title
),
col as (
  insert into public.product_colors (product_id, color_code)
  select ins.id, unnest(s.colors) from ins join s on s.title = ins.title
)
insert into public.product_trade_methods (product_id, trade_method_code)
select ins.id, unnest(s.trades) from ins join s on s.title = ins.title;

-- 확인: 12 가 나오면 성공
select count(*) as 예시상품수
from public.products
where seller_id = 'a0000000-0000-4000-8000-000000000001';


-- =====================================================================
-- 예시 데이터 삭제 (필요할 때만, 아래 주석 기호 -- 를 지우고 이 줄만 실행)
-- 예시 판매자를 지우면 그 상품도 함께 지워집니다.
-- =====================================================================
-- delete from auth.users where id = 'a0000000-0000-4000-8000-000000000001';
