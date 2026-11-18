-- =====================================================================
-- 리얼해브 기초 데이터 (목업 기준) — 테이블 생성 후 1번만 실행
-- =====================================================================

-- 구매처
insert into public.purchase_places (code, region, name, sort_order) values
  ('dom_h_dept',   'domestic', '국내H백화점', 1),
  ('dom_l_dept',   'domestic', '국내L백화점', 2),
  ('dom_s_dept',   'domestic', '국내S백화점', 3),
  ('dom_roadshop', 'domestic', '국내로드샵',  4),
  ('dom_dutyfree', 'domestic', '국내면세점',  5),
  ('dom_etc',      'domestic', '국내구매',    6),
  ('ovs_dept',     'overseas', '해외백화점',  7),
  ('ovs_roadshop', 'overseas', '해외로드샵',  8),
  ('ovs_dutyfree', 'overseas', '해외면세점',  9),
  ('ovs_etc',      'overseas', '해외구매',   10);

-- 거래방식
insert into public.trade_methods (code, name, sort_order) values
  ('direct',      '직거래',   1),
  ('parcel',      '일반택배', 2),
  ('half_parcel', '반값택배', 3);

-- 색상 12개 (목업 순서)
insert into public.colors (code, name, hex, sort_order) values
  ('black',  '블랙',     '#111111',  1),
  ('blue',   '블루',     '#1E3A8A',  2),
  ('brown',  '브라운',   '#6B5B34',  3),
  ('green',  '그린',     '#0F7B4E',  4),
  ('gray',   '그레이',   '#8B8F97',  5),
  ('multi',  '멀티컬러', null,       6),
  ('pink',   '핑크',     '#F07C99',  7),
  ('purple', '퍼플',     '#4B2E9E',  8),
  ('red',    '레드',     '#D2123B',  9),
  ('white',  '화이트',   '#FFFFFF', 10),
  ('yellow', '옐로우',   '#F5C518', 11),
  ('navy',   '네이비',   '#1B2A4A', 12);

-- 카테고리 13개 대분류 + 소분류
with top (name, size_type, sort_order, subs) as (
  values
    ('여성의류',    'clothing'::public.size_type,  1, array['티셔츠','블라우스/셔츠','스커트','원피스','팬츠','니트/가디건','점퍼/자켓','코트','수영복','기타']),
    ('남성의류',    'clothing'::public.size_type,  2, array['티셔츠','셔츠','팬츠','니트/가디건','점퍼/자켓','정장','코트','다운재킷','수영복','기타']),
    ('여성슈즈',    'shoes'::public.size_type,     3, array['스니커즈','샌들','로퍼','부츠','하이힐/구두','기타']),
    ('남성슈즈',    'shoes'::public.size_type,     4, array['스니커즈','로퍼','구두','기타']),
    ('가방/핸드백', 'none'::public.size_type,      5, array['여성가방','남성가방','여성크로스백','남성크로스백','백팩','서류가방','여행가방/캐리어','토트백/버킷백','숄더백/체인백','슬링백/웨이스트백']),
    ('지갑/벨트',   'none'::public.size_type,      6, array['여성지갑','남성지갑','여성벨트','남성벨트','카드지갑/코인케이스']),
    ('시계',        'none'::public.size_type,      7, array['남성시계','여성시계','시계밴드','기타']),
    ('주얼리',      'none'::public.size_type,      8, array['목걸이/펜던트','팔찌/뱅글','반지','브로치/뱃지','귀걸이','기타']),
    ('아이웨어',    'none'::public.size_type,      9, array['선글라스','안경테']),
    ('유아동(남)',  'kids'::public.size_type,     10, array['티셔츠','셔츠','팬츠','니트/가디건','점퍼/자켓','코트','다운재킷','수영복','기타']),
    ('유아동(여)',  'kids'::public.size_type,     11, array['티셔츠','셔츠','팬츠','니트/가디건','점퍼/자켓','코트','다운재킷','수영복','기타']),
    ('가전',        'none'::public.size_type,     12, array['핸드폰','이어폰','헤드폰','스피커/엠프','조명기기','카메라','카메라렌즈','카메라용품','스타일러','세탁기','건조기','공기청정기','청소기']),
    ('가구',        'none'::public.size_type,     13, array['침대','의자','책상','식탁','협탁','장식장'])
),
inserted as (
  insert into public.categories (name, size_type, sort_order)
  select name, size_type, sort_order from top
  returning id, name
)
insert into public.categories (parent_id, name, sort_order)
select i.id, s.sub, s.ord
from inserted i
join top t on t.name = i.name
cross join lateral unnest(t.subs) with ordinality as s(sub, ord);

-- 브랜드 (목업에 나온 브랜드만 — 나머지는 관리자 화면에서 추가)
insert into public.brands (name_en, name_ko, origin_country, is_popular, popular_order) values
  ('LOUIS VUITTON',   '루이비통',     '프랑스',   true, 1),
  ('HERMÈS',          '에르메스',     '프랑스',   true, 2),
  ('CHANEL',          '샤넬',         '프랑스',   true, 3),
  ('BANG & OLUFSEN',  '뱅앤올룹슨',   '덴마크',   true, 4),
  ('TIFFANY & CO.',   '티파니앤코',   '미국',     true, 5),
  ('ROLEX',           '롤렉스',       '스위스',   true, 6),
  ('GUCCI',           '구찌',         '이탈리아', true, 7),
  ('PRADA',           '프라다',       '이탈리아', true, 8),
  ('LORO PIANA',      '로로피아나',   '이탈리아', true, 9),
  ('CASIMA',          '카시마',       '이탈리아', false, null);
