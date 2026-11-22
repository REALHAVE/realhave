# 리얼해브 진행 현황

> 마지막 업데이트: 2026-11-22. 기준 설계 문서는 `docs/step1-design.md`입니다.

## 완료

| 단계 | 내용 | 비고 |
|---|---|---|
| 0 | Node.js · Git 설치, GitHub · Vercel · Supabase 계정 | |
| 1 | Supabase 테이블 · RLS · 기초데이터 | `supabase/setup-all.sql` 실행, `check-setup.sql` 결과 전부 OK |
| 2 | Next.js 화면 뼈대 (색상 · 폰트 · 하단 탭) | 프로젝트 폴더: `C:\dev\realhave` (OneDrive에서 이전) |
| 3 | GitHub(비공개) 업로드 + Vercel 배포 | https://realhave.vercel.app · main 브랜치에 올리면 자동 배포 |
| 4 | 이메일 회원가입 · 로그인 · 비밀번호 찾기 | 배포 사이트에서 가입·메일 코드 확인 완료 (2026-11-22) |
| 5 | 홈 · 카테고리 · A-Z · 검색 · 상품목록 · 상품상세 | 예시 상품 12개 (supabase/sample-data.sql, 삭제 방법은 파일 맨 아래). DB: migration 10 (product_cards 뷰) |
| 6 | 상품등록 (사진·인증사진 업로드 → 심사대기) | migration 11. 인증서류 자동 가림(OCR)은 나중에 (결정 14) |
| 7 | 관리자 로그인 + 정품인증 심사 | https://realhave.vercel.app/admin · migration 12 · 관리자 등록은 admins 표 |
| 8 | 찜, 실시간 채팅(사진 전송), 채팅 목록 안 읽음 숫자 | migration 14 · 끊긴 사이 메시지는 재조회로 보완 |
| 9 ① | 판매내역(탭·끌어올리기·⋮ 메뉴), 게시글 수정·재심사, 삭제, 재등록, 거래완료(구매자 미선택), 조회수 | migration 13 |
| 9 ② | 구매자 선택(채팅한 사람 중) → 거래완료, 구매내역, 구매자용 상세 표시 | DB 변경 없음 |

## 결정 변경 (2026-11-18)
- PASS 본인인증은 하지 않습니다. 대신 **이메일 6자리 코드 인증**을 합니다.
- 휴대폰번호는 **필수 입력**이지만, 진짜 번호인지는 확인하지 않습니다.
- CI(중복가입 방지값)는 저장하지 않습니다. → DB 수정 파일: `supabase/migrations/20261118000009_email_auth.sql` (Supabase에 실행 완료)

## 해결 기록 (2026-11-22)
- Vercel 환경변수: 팀 공유변수가 아니라 **프로젝트 Settings → Environment Variables**에 넣어야 합니다. Value 칸에는 `=` 뒤의 값만 넣습니다.
- 점검 주소: https://realhave.vercel.app/api/health (두 항목이 "ok"이면 정상. 키 값은 보여주지 않음)
- 인증 메일: Supabase 기본 메일은 템플릿 수정이 불가합니다. → **리얼해브 Gmail을 SMTP로 연결**했습니다 (smtp.gmail.com:465, 16자리 앱 비밀번호 사용).
- 메일 발송 오류는 Supabase → Logs → Auth에서 원인을 볼 수 있습니다. (534 = 앱 비밀번호가 필요함, 535 = 아이디·비밀번호가 틀림)

## 남은 일
1. 9단계 ② 테스트 (두 계정)
2. **10단계**: 관리자 나머지 (대시보드·카테고리/브랜드·회원 중지/허용·거래관리·신고/CS·공지·권한)
3. 11단계: 신고하기·1:1 문의·공지사항(회원 화면), 회원탈퇴
4. 12단계: 소셜 로그인 / 13단계: PWA·도메인·약관·보안 점검
5. 나중에: 인증서류 자동 가림(OCR 서비스 선택)

## 내 PC에서 실행하는 법
- 폴더 `C:\dev\realhave`에서 `npm run dev`를 실행한 뒤 브라우저로 http://localhost:3000 에 접속합니다.
- 비밀키 파일 `.env.local`은 이 폴더에만 있고, GitHub에는 올라가지 않습니다.

## 참고
- 바탕화면의 예전 `OneDrive\Desktop\REALHAVE` 폴더는 더 이상 쓰지 않습니다. 확인 후 지우셔도 됩니다.
- 지금은 Gmail(하루 약 500통)로 발송합니다. 회원이 많아지거나 도메인을 사면 전문 발송 서비스(Resend 등)로 바꾸는 것을 검토합니다.
