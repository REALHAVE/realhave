# 리얼해브 1단계 설계안 (DB · RLS · 폴더 구조 · 개발 순서 · 계정 준비)

> 기준 자료: realhave-mobile-main.html, realhave-admin-full.html, realhave-integration-demo.html, realhave-handoff-spec.md, realhave-claude-code-kickoff.md
> 상태: **결정사항 반영본 (2026-11-15)**. "❓"는 추가 확인 대기 항목입니다. 결정 내역은 맨 아래 6번 참고.

---

## 1. DB 테이블 설계

### 1-1. 전체 관계도

```
auth.users (Supabase 로그인 계정)
   └─1:1─ profiles (공개 정보: 닉네임)
   └─1:1─ user_private (비공개: 휴대폰번호, 약관동의 시각)
   └─1:1─ admins (관리자인 경우만)

categories (대분류 ─< 소분류, 자기참조)
brands
purchase_places (구매처 10개)
trade_methods (거래방식 3개)
colors (색상 12개)

products ── seller → profiles
   ├─< product_images        (공개 상품사진, 최대 10장)
   ├─< product_cert_images   (정품인증 증빙: 한글택·인보이스, 비공개)
   ├─< auth_reviews          (정품인증 심사 이력: 지금은 수동, 나중에 AI)
   ├─< product_trade_methods >─ trade_methods   (복수선택)
   ├─< product_colors        >─ colors          (복수선택)
   ├─< wishlists             >─ profiles        (찜)
   ├─< chat_rooms (상품 1개 × 구매희망자 1명 = 방 1개)
   │      └─< messages
   └─1:1─ deals (거래완료 기록, 구매자 선택 결과)

reports (신고) · inquiries (1:1 문의) · notices (공지/이벤트)
```

### 1-2. 회원

**profiles** — 누구나 볼 수 있는 회원 정보

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | = auth.users.id |
| nickname | text, unique | 목업의 `realhave_user92` 같은 이름 |
| avatar_path | text, null | 프로필 사진 (선택) |
| status | enum `active` / `suspended` | 관리자 "자격중지 / 자격허용" |
| suspended_reason | text, null | 중지 사유 (관리자 메모) |
| created_at | timestamptz | 가입일 |

**user_private** — 본인과 관리자만 볼 수 있는 정보 (분리 이유: RLS는 "행" 단위라서, 같은 테이블에 두면 닉네임을 공개할 때 전화번호도 같이 공개됨)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| user_id | uuid PK → profiles | |
| phone | text, **필수** | PASS 본인인증으로 확인된 번호 |
| identity_verified_at | timestamptz | PASS 본인인증 완료 시각 |
| ci_hash | text, unique | 본인인증 대행사가 주는 개인 고유값(CI)을 암호화해 저장 → 한 사람이 계정을 여러 개 만드는 것 방지 (❓ 저장 여부 확인) |
| terms_agreed_at | timestamptz | 이용약관 동의 시각 |
| privacy_agreed_at | timestamptz | 개인정보처리방침 동의 시각 |

> 이메일·비밀번호는 Supabase가 `auth.users`에 따로 안전하게 보관합니다 (우리 테이블에 저장하지 않음).

### 1-3. 기준 데이터 (관리자가 관리)

**categories** — 대분류/소분류 2단계

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| parent_id | uuid, null → categories | null이면 대분류 |
| name | text | 여성의류, 티셔츠 … |
| size_type | enum `none` / `clothing` / `shoes` | 사이즈 필드 활성화·옵션 자동전환 규칙. 대분류에 지정, 소분류는 상속 |
| sort_order | int | 화면 순서 |
| is_active | bool | 삭제 대신 숨김 가능 |

- 대분류 13개 확정: 여성의류, 남성의류, 여성슈즈, 남성슈즈, 가방/핸드백, 지갑/벨트, 시계, 주얼리, 아이웨어, 유아동(남), 유아동(여), 가전, 가구
- 사이즈 옵션: `clothing` → 44/55/66/77/90/95/100/103/105/110/115/그외, `shoes` → 180~300 (5단위)
- 유아동(남/여)은 `kids` → 80/90/100/110/120/130/140/150/160/그외 (호수, 목록 변경 가능)
- size_type 최종: `none` / `clothing` / `shoes` / `kids`

**brands**

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| name_en | text, unique | 표시명 (HERMÈS) |
| name_ko | text | 한글 검색용 (에르메스) — 검색창에 "에르메스 버킨백"을 쳐도 찾기 위함 |
| origin_country | text | 프랑스, 이탈리아 … (A-Z 화면) |
| index_letter | char(1) | A-Z 인덱스 글자 |
| logo_path | text, null | |
| is_popular | bool | 홈 "인기브랜드" 9칸 노출 |
| popular_order | int, null | 인기브랜드 순서 |
| is_active | bool | |

**purchase_places** (구매처) — id, region(`domestic`/`overseas`), name, sort_order
→ 국내H백화점·국내L백화점·국내S백화점·국내로드샵·국내면세점·국내구매 / 해외백화점·해외로드샵·해외면세점·해외구매 (목업대로 해외 포함 확정)

**trade_methods** (거래방식) — code(PK), name: `direct` 직거래 / `parcel` 일반택배 / `half_parcel` 반값택배

**colors** — id, name, hex, sort_order: 블랙·블루·브라운·그린·그레이·멀티컬러·핑크·퍼플·레드·화이트·옐로우·네이비

### 1-4. 상품

**products**

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| seller_id | uuid → profiles | |
| title | text | 제목 |
| brand_id | uuid → brands | |
| category_id | uuid → categories | 소분류 |
| purchase_place_id | uuid → purchase_places | 단일선택 |
| size | text, null | 카테고리 size_type이 `none`이면 반드시 비어 있음 (DB에서 검사) |
| condition_grade | enum `NEW`/`A+`/`A`/`B+`/`B`/`C` | 상태등급 |
| price | bigint, > 0 | 원 단위 |
| description | text | 자세한 설명 |
| status | enum `on_sale` / `sold` / `deleted` | 판매중 / 거래완료 / 삭제(기록은 남김) |
| auth_status | enum `pending` / `approved` / `rejected` | 정품인증 심사 상태 (가장 최근 심사 결과) |
| view_count | int | 조회수 |
| bumped_at | timestamptz | 끌어올리기 시각. "최신등록상품" 정렬 기준. **상품별 24시간에 1회** (함수에서 검사) |
| source_product_id | uuid, null → products | "재등록"으로 복사된 글이면 원본 글 ID |
| created_at / updated_at | timestamptz | |
| sold_at | timestamptz, null | |

**product_images** — id, product_id, storage_path, sort_order(0 = 대표사진), created_at · 최대 10장

**product_cert_images** (정품인증 증빙) — id, product_id, storage_path(원본, 비공개), kind(`tag` 한글택 / `invoice` 인보이스 / `receipt` 영수증), masked_path(가격·카드번호를 가린 사본), masking_status(`pending`/`done`/`failed`), created_at
> 원본은 본인·관리자만 열람. 가린 사본은 **로그인한 회원에게만** 상품상세에서 표시.

**자동 마스킹 흐름 (확정: 1단계부터 자동)**
1. 판매자가 택·인보이스 원본 업로드 → 비공개 `cert-docs`에 저장
2. 서버가 외부 OCR 서비스로 글자를 읽고, 가격·카드번호로 보이는 부분을 찾아 검은 박스로 가린 사본을 `cert-masked`에 저장 (OCR 서비스 키는 서버에만 있음)
3. 관리자가 심사할 때 원본과 사본을 나란히 보고 "가림이 제대로 됐는지" 확인. 놓친 부분이 있으면 승인하지 않음 (`masking_status=failed`면 승인 버튼 잠금)
4. OCR이 읽은 원문은 `auth_reviews.ai_result`에 남기지 않음 (카드번호가 DB에 남지 않도록 — 위치 정보만 저장)
> 같은 OCR을 나중에 "한글택 진위 분석(AI 자동심사)"에도 재사용 가능
> ❓ OCR 서비스 선택(Google Cloud Vision / 네이버 CLOVA OCR 등)은 마스킹 개발 단계 전에 확정

**auth_reviews** (정품인증 심사 이력 — AI 확장 지점)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| product_id | uuid → products | |
| method | enum `manual` / `ai` | 1단계는 항상 `manual` |
| status | enum `pending` / `approved` / `rejected` / `needs_check` | `needs_check` = AI가 "재확인 필요"로 판단 (관리자 화면 배지) |
| ai_result | jsonb, null | 나중에 OCR 결과(인식된 택 문구, 일치 여부 등)를 그대로 저장 |
| ai_score | numeric, null | AI 신뢰도 |
| reviewer_id | uuid, null → admins | 승인/반려한 관리자 |
| reject_reason | text, null | 반려 사유 (판매자에게 표시) |
| created_at / decided_at | timestamptz | |

> AI는 나중에 "심사 이력 한 줄을 `method=ai`로 추가"하는 방식으로 붙입니다. 테이블과 화면을 고칠 필요가 없습니다.

**심사 상태 흐름 (확정)**
- 등록 → `pending`(심사대기, 비공개) → 승인 `approved`(공개) / 반려 `rejected`(비공개, 반려 사유 표시)
- 반려된 상품은 수정 후 **재심사 요청** 가능 → 다시 `pending`
- 승인된 상품에서 **브랜드·카테고리·구매처·인증 사진**을 바꾸면 자동으로 `pending`(재심사, 그동안 비공개). 가격·설명·거래방식 등 나머지 수정은 재심사 없음 (❓ 범위 이견 있으면 말씀)

**product_trade_methods** — (product_id, trade_method_code) 복합 PK → 거래방식 복수선택
**product_colors** — (product_id, color_id) 복합 PK → 색상 복수선택

### 1-5. 찜 · 채팅 · 거래

**wishlists** — (user_id, product_id) 복합 PK, created_at

**chat_rooms**

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| product_id | uuid → products | |
| seller_id / buyer_id | uuid → profiles | 둘이 같을 수 없음 |
| last_message_at / last_message_preview | | 채팅 목록 정렬·미리보기 |
| seller_last_read_at / buyer_last_read_at | timestamptz | 안 읽은 메시지 수(빨간 숫자) 계산용 |
| created_at | | |
| unique(product_id, buyer_id) | | 같은 상품에 같은 구매자는 방 하나 |

**messages** — id, room_id, sender_id, body(null 가능), image_path(null — 채팅 사진 전송 확정), created_at · body와 image_path 중 하나는 반드시 있어야 함

**deals** (거래완료 기록)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| product_id | uuid, unique → products | 상품당 1건 |
| seller_id | uuid → profiles | |
| buyer_id | uuid, null → profiles | "선택하지 않을래요"면 null |
| price | bigint | 완료 시점 가격 기록 |
| trade_method_code | null | 실제 거래방식 (관리자 거래관리 화면용, 선택 입력) |
| completed_at | timestamptz | |

- 구매내역 = `deals.buyer_id = 나`
- 관리자 "거래관리"의 진행상태(채팅중 / 구매자 선택 대기 / 거래완료)는 chat_rooms·deals를 조합해서 계산 (별도 저장 안 함)

### 1-6. 운영

**reports** (신고) — id, reporter_id, target_type(`product`/`user`/`chat`), target_product_id, target_user_id, target_room_id(채팅 신고 시), reason, detail, status(`open`/`resolved`/`dismissed`), admin_note, handled_by, handled_at, created_at
- reason 확정: `fake_suspect` 정품 의심 / `false_listing` 허위매물 / `no_response` 응답 없음 / `bad_manner` 비매너 / `etc` 기타
- 채팅방 안에서 신고하면 target_room_id가 기록되고, **그 대화만** 관리자가 열람 가능

**inquiries** (1:1 문의 — 관리자 목업 "신고/CS 관리"에 있어 추가) — id, user_id, title, body, status(`waiting`/`answered`), answer, answered_by, answered_at, created_at

**notices** (공지/이벤트) — id, kind(`notice`/`event`), title, body, is_published, published_at, created_by, created_at

**admins**

| 컬럼 | 타입 | 설명 |
|---|---|---|
| user_id | uuid PK → profiles | 관리자도 Supabase 계정으로 로그인 |
| role | enum `master` / `product` / `cs` | 전체 권한 / 상품관리만 / 신고·CS만 (목업 "계정/권한 설정") |
| created_by | uuid | |
| created_at | | |

- 최근 로그인 시각은 Supabase `auth.users.last_sign_in_at`에서 가져옴

### 1-7. 테이블로 만들지 않는 것

- 최근검색어: 사용자 기기에 저장 (서버 저장 불필요)
- 마이페이지 숫자(구매/판매/찜/채팅): 각 테이블에서 개수만 셈
- 메인 노출 순위 광고비 로직: 미정이라 지금은 만들지 않음. 나중에 products에 컬럼 추가로 대응 가능

---

## 2. RLS(행 단위 보안) 정책 초안

### 2-1. 공통 원칙

- **모든 테이블 RLS 켬.** 정책이 없는 동작은 자동 차단.
- 보조 함수 (DB 안에 만듦)
  - `is_admin(role)` — 현재 로그인한 사람이 해당 권한의 관리자인지 (`master`는 모든 권한 통과)
  - `is_active_user()` — 로그인했고 자격중지가 아닌지
- **중요한 상태 변경은 직접 수정 금지, 전용 함수(RPC)로만**: 심사 승인/반려, 거래완료, 끌어올리기, 조회수 증가, 탈퇴. 함수 안에서 조건을 검사하므로 앱 화면을 우회해도 조작 불가.
- `service_role` 키(모든 보안 우회)는 서버 전용. 브라우저 코드·GitHub에 절대 안 들어감.
- 표기: 비회원 = 로그인 안 한 사람, 본인 = 그 행의 주인, 관리자(역할) = admins 테이블 기준

### 2-2. 테이블별

| 테이블 | 조회 | 추가 | 수정 | 삭제 |
|---|---|---|---|---|
| profiles | 누구나 (닉네임 등 공개정보만 있음) | 가입 시 자동 생성 (트리거) | 본인: 닉네임·사진만 / status는 관리자(master)만 | 탈퇴 함수 또는 관리자(master) |
| user_private | 본인, 관리자(master·cs) | 가입 시 자동 | 본인 | 탈퇴 시 함께 |
| categories / brands / purchase_places / trade_methods / colors | 누구나 (is_active인 것) · 관리자는 전체 | 관리자(product) | 관리자(product) | 관리자(product) — 상품이 연결돼 있으면 숨김 처리 권장 |
| products | 누구나: `approved` + `on_sale/sold` + 판매자가 정상회원 / 본인: 내 상품 전부 / 관리자(product): 전부 | 정상회원, seller_id = 본인, auth_status는 강제로 `pending` | 본인: 내용 필드만 (status·auth_status·view_count·bumped_at 변경 불가 — 트리거로 차단) | 직접 삭제 없음 → 본인이 `deleted`로 변경 |
| product_images | 상품을 볼 수 있는 사람 | 상품 주인 (10장 제한) | 상품 주인 | 상품 주인 |
| product_cert_images | **상품 주인, 관리자(product)만** | 상품 주인 | 없음 | 상품 주인 (심사 전까지) |
| auth_reviews | 상품 주인, 관리자(product) | 상품 등록 시 자동 (`manual`/`pending`) · AI는 서버만 | 관리자(product)가 승인/반려 함수로 | 없음 |
| product_trade_methods / product_colors | 상품을 볼 수 있는 사람 | 상품 주인 | — | 상품 주인 |
| wishlists | 본인 | 본인 (정상회원) | — | 본인 |
| chat_rooms | 구매자·판매자 당사자 / 관리자(cs): **신고된 방만** | 정상회원이 구매자로, 내 상품이 아니고 판매중일 때 | 읽음 시각만, 함수로 | 탈퇴 함수 (양쪽 모두 삭제) |
| messages | 그 방의 당사자 / 관리자(cs): **신고된 방의 메시지만** | 그 방의 당사자 + 정상회원 + sender_id = 본인 | 없음 | 없음 (탈퇴 시 함수로) |
| deals | 판매자, 구매자, 관리자 | **거래완료 함수만** (구매자는 그 상품으로 채팅한 사람 중에서만 선택 가능) | 없음 (재등록은 새 글 복사라 거래기록은 그대로) | 탈퇴 함수 (양쪽 기록 모두), 관리자(master) |
| reports | 신고자 본인, 관리자(cs) | 정상회원, reporter_id = 본인 | 관리자(cs) | 없음 |
| inquiries | 작성자 본인, 관리자(cs) | 로그인 회원 | 답변은 관리자(cs) | 없음 |
| notices | 누구나: 게시중인 글 / 관리자: 전체 | 관리자(cs 이상, ❓ 담당 역할 확인) | 관리자 | 관리자 |
| admins | 본인 행, 관리자(master)는 전체 | 관리자(master) | 관리자(master) | 관리자(master), 자기 자신 삭제 불가 |

### 2-3. 사진 저장소(Storage) 정책

| 버킷 | 공개 | 규칙 |
|---|---|---|
| `product-images` | 공개 읽기 | 업로드·삭제는 본인 폴더(`사용자ID/…`)만 |
| `cert-docs` | **비공개** | 원본. 본인 폴더 업로드, 읽기는 본인 + 관리자(product). 관리자 화면에서는 몇 분짜리 임시 링크로만 표시 |
| `cert-masked` | 비공개 (로그인 회원은 임시 링크로 열람) | 가린 사본. 읽기: 로그인 회원 + 승인된 상품만 / 본인 / 관리자. 쓰기: 서버(마스킹 처리)만 |
| `chat-images` | 비공개 | 그 채팅방 당사자 + 신고된 방이면 관리자(cs) |

### 2-4. 회원탈퇴 처리 (확정: 상대방 기록도 삭제)
탈퇴 함수 하나가 순서대로 처리: 판매중 상품 있으면 거절 → 본인이 참여한 채팅방·메시지·채팅사진(양쪽 모두) 삭제 → 본인이 판매자/구매자인 거래기록(양쪽 모두) 삭제 → 찜·내 상품·사진 삭제 → 계정 삭제.
❓ 신고 처리 중인 대화의 증거 보존 여부는 추가 확인 (아래 질문).

---

## 3. 프로젝트 폴더 구조

관리자 페이지는 **같은 프로젝트의 `/admin` 주소**로 만드는 것을 제안합니다 (배포 1번, 비용 0, 같은 DB 규칙 공유).

```
REALHAVE/
├─ docs/                     ← 목업·기획서·이 설계안 (참고용, 서비스에는 안 올라감)
├─ supabase/
│  ├─ migrations/            ← 테이블·RLS·함수 SQL (번호 순서대로 실행)
│  └─ seed.sql               ← 카테고리·브랜드·구매처·색상 기초 데이터
├─ public/                   ← 아이콘, PWA 설정(manifest)
├─ src/
│  ├─ app/                   ← 화면(주소)별 폴더
│  │  ├─ (tabs)/             ← 하단 탭이 있는 화면
│  │  │  ├─ page.tsx         ← 홈
│  │  │  ├─ category/        ← 카테고리
│  │  │  ├─ designers/       ← A-Z Designers
│  │  │  └─ mypage/          ← 마이페이지
│  │  ├─ (auth)/             ← login / signup / forgot
│  │  ├─ search/             ← 검색
│  │  ├─ list/               ← 카테고리·브랜드별 상품 목록
│  │  ├─ products/[id]/      ← 상품 상세
│  │  ├─ sell/               ← 상품등록 (+ brand/ 브랜드 선택)
│  │  ├─ chat/ , chat/[roomId]/
│  │  ├─ wishlist/ , sales/ , sales/[id]/buyer/ , purchases/
│  │  ├─ withdraw/
│  │  └─ admin/              ← 관리자 (로그인, 대시보드, 상품, 회원, 거래, 신고/CS, 공지, 권한)
│  ├─ components/            ← 버튼·카드·하단탭 등 재사용 부품
│  ├─ lib/
│  │  ├─ supabase/           ← DB 연결 (브라우저용 / 서버용)
│  │  ├─ verification/       ← 정품인증 모듈: 지금은 "수동심사", 나중에 "AI" 추가
│  │  └─ constants.ts        ← 사이즈 옵션 등 고정값
│  ├─ styles/                ← 색상·폰트 (#4D1437 등 디자인 토큰)
│  └─ types/                 ← DB 구조에서 자동 생성되는 타입
├─ middleware.ts             ← 로그인 필요한 주소 보호, /admin 보호
├─ .env.local                ← 비밀키 (GitHub에 절대 안 올라감)
├─ .env.example              ← 어떤 키가 필요한지만 적은 빈 양식
└─ .gitignore
```

---

## 4. 개발 순서

| 단계 | 내용 | 대표님 확인 방법 |
|---|---|---|
| 0 | 계정 준비 + PC에 Node.js·Git 설치 (아래 5번) | 제가 버전 확인 명령으로 점검 |
| 1 | Supabase에 테이블·RLS·기초데이터 넣기 | Supabase 화면 Table Editor에서 테이블 목록과 각 테이블의 "RLS enabled" 표시 확인 |
| 2 | Next.js 프로젝트 생성, 색상·폰트, 하단 탭 뼈대 | 내 PC 브라우저에서 `localhost:3000` 접속 |
| 3 | GitHub 업로드 + Vercel 첫 배포 | 휴대폰으로 배포 주소 접속 |
| 4 | 이메일 회원가입/로그인/비밀번호 찾기, 로그인 게이팅, 마이페이지 비회원/회원 분기, "(Log in)" 표시 | 가입 → 로그아웃 → 상품등록 눌러서 로그인 화면으로 가는지 |
| 5 | 홈·카테고리·A-Z·검색·상품목록·상품상세 (예시 상품으로) | 목업과 나란히 놓고 비교 |
| 6 | 상품등록: 사진·정품인증 사진 업로드, 브랜드 검색, 사이즈 자동전환, 거래방식·색상 복수선택 → 심사대기 | 등록 후 판매내역에 "심사대기" 표시 |
| 7 | 관리자 로그인 + 정품인증 심사(승인/반려) | 연동 데모처럼: 휴대폰에서 등록 → PC 관리자에서 승인 → 홈에 노출 |
| 8 | 찜, 채팅(실시간), 채팅 목록 안 읽음 숫자 | 휴대폰 2대(또는 PC+휴대폰)로 대화 |
| 9 | 판매내역(끌어올리기, ⋮ 메뉴), 구매자 선택 → 거래완료, 구매내역, 상세화면 상태 분기 | 거래완료 후 구매자 계정 구매내역에 보이는지 |
| 10 | 관리자 나머지: 카테고리/브랜드, 회원 중지/허용/삭제, 거래관리, 신고/CS, 공지, 관리자 권한 | 중지된 회원이 글쓰기·채팅이 막히는지 |
| 11 | 사용자 쪽 신고하기·1:1 문의·공지사항, 회원탈퇴 흐름 | 판매중 상품 있을 때 탈퇴 차단되는지 |
| 12 | 소셜 로그인 (카카오·Apple·Google) | 각 버튼으로 가입 |
| 13 | PWA(홈 화면에 추가), 도메인, 약관·개인정보처리방침, 오픈 전 보안 점검 | 휴대폰 홈 화면 아이콘으로 실행 |

> 킥오프 문서 로드맵과 다른 점: **관리자 심사(7)를 앞당겼습니다.** 심사 승인이 있어야 등록한 상품이 홈에 보이기 때문입니다. 배포(3)도 앞당겨서 처음부터 휴대폰으로 확인하실 수 있게 했습니다.

---

## 5. 대표님이 직접 준비할 것

### 지금 필요 (1~3단계)
- [ ] **Node.js LTS 설치** — 현재 PC에 없음. nodejs.org에서 "LTS" 버전 설치
- [ ] **Git 설치** — 현재 PC에 없음. git-scm.com에서 Windows용 설치 (옵션은 기본값 그대로)
- [ ] **GitHub 계정** (무료) — 2단계 인증 켜기 권장
- [ ] **Supabase 계정** (무료 플랜) — 가입 후 새 프로젝트 생성
  - 지역(Region): **Seoul (Northeast Asia)** 선택
  - 이때 정하는 **DB 비밀번호는 따로 안전하게 보관** (비밀번호 관리 앱 권장)
  - 무료 플랜은 오래 사용하지 않으면 프로젝트가 일시정지될 수 있음 (다시 켜면 됨)
- [ ] **Vercel 계정** — "Continue with GitHub"로 가입하면 연결이 쉬움
  - 무료(Hobby) 플랜은 비상업용 조건이라, 정식 오픈 전 유료(Pro) 전환 검토 필요

### 나중에 필요
- [ ] 이메일 발송 서비스 (오픈 전) — Supabase 기본 메일은 시간당 발송량이 매우 적어 실서비스엔 부족
- [ ] 도메인 (realhave.com / .co.kr 등)
- [ ] 카카오 디벨로퍼스, Google Cloud, Apple Developer(연회비 유료) — 12단계 소셜 로그인용
- [ ] 통신판매업 신고, 이용약관·개인정보처리방침 (오픈 전, 전문가 검토 권장)

### 결정사항 때문에 추가로 필요한 것
- [ ] **PASS 본인인증 대행사 계약** (예: NICE평가정보, KCB, 다날 등) — 보통 **사업자등록증**이 필요하고 심사·계약에 시간이 걸리므로 **미리 문의 권장**. 계약 전까지는 개발용 "테스트 인증"으로 화면을 만들어 두고, 계약 후 실제 연결
- [ ] **OCR 서비스 가입** (Google Cloud Vision 또는 네이버 CLOVA OCR 등, 사용량 과금, 결제카드 등록 필요) — 상품등록 단계(6) 전까지

### 비밀키 다루는 법
- Supabase 키는 **채팅창에 붙여넣지 마세요.** 3단계에서 `.env.local` 파일을 만들어 드리면 대표님이 직접 그 파일에 붙여넣습니다.
- 특히 `service_role` 키는 모든 보안을 우회하는 열쇠라 어디에도 공유하면 안 됩니다.

---

## 6. 결정 내역 (2026-11-15)

| # | 항목 | 결정 |
|---|---|---|
| 1 | 해외 구매처 | 목업대로 유지 |
| 2 | 승인 전 노출 | 승인 전에는 숨김 |
| 3 | 인증 서류 | 1단계부터 외부 OCR로 가격·카드번호 자동 마스킹, 관리자가 심사 때 확인. 가린 사본은 로그인 회원만 열람 |
| 4 | 반려 후 | 수정 후 재심사 가능 |
| 5 | 수정 시 | 재심사 |
| 6 | 카테고리 | 목업대로 13개, 유아동은 호수 사이즈(80~160, 그외) |
| 7 | 휴대폰번호 | ~~가입 시 필수, PASS 본인인증~~ → **2026-11-18 변경: PASS 안 함. 이메일 6자리 코드 인증. 휴대폰번호는 필수 입력(진위 미확인). CI 저장 안 함 (migration 9)** |
| 8 | 탈퇴 | 상대방 기록도 삭제 |
| 9 | 관리자 채팅 열람 | 신고된 대화만 |
| 10 | 끌어올리기 | 상품별 24시간 1회 |
| 11 | 재등록 | 새 글로 복사 |
| 12 | 신고 사유 | 정품 의심 / 허위매물 / 응답 없음 / 비매너 / 기타 |
| 13 | 채팅 사진 | 전송 가능 |
| 14 | 인증서류 자동 가림 시점 (2026-11-22) | 6단계는 업로드·등록·심사대기까지. 인증 원본은 비공개 보관(본인·관리자만). OCR 서비스 선택과 가린 사본 공개는 나중에 별도로 연결 (결정 3의 시점만 미룸) |
| 15 | 탈퇴 시 신고 증거 (2026-11-25) | 미처리 신고와 관련된 대화는 탈퇴해도 신고 기록에 사본으로 보관 (원본 대화·거래기록은 결정 8대로 삭제). 관리자 회원삭제도 같은 방식 |
