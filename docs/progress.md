# 리얼해브 진행 현황

> 마지막 업데이트: 2026-11-18. 기준 설계 문서는 `docs/step1-design.md`입니다.

## 완료

| 단계 | 내용 | 비고 |
|---|---|---|
| 0 | Node.js · Git 설치, GitHub · Vercel · Supabase 계정 | |
| 1 | Supabase 테이블 · RLS · 기초데이터 | `supabase/setup-all.sql` 실행, `check-setup.sql` 결과 전부 OK |
| 2 | Next.js 화면 뼈대 (색상 · 폰트 · 하단 탭) | 프로젝트 폴더: `C:\dev\realhave` (OneDrive에서 이전) |
| 3 | GitHub(비공개) 업로드 + Vercel 배포 | https://realhave.vercel.app · main 브랜치에 올리면 자동 배포 |
| 4 | 이메일 회원가입 · 로그인 · 비밀번호 찾기 (코드 작성) | 내 PC에서 동작 확인. 배포 사이트는 아래 "남은 일" 참고 |

## 결정 변경 (2026-11-18)
- PASS 본인인증은 하지 않습니다. 대신 **이메일 6자리 코드 인증**을 합니다.
- 휴대폰번호는 **필수 입력**이지만, 진짜 번호인지는 확인하지 않습니다.
- CI(중복가입 방지값)는 저장하지 않습니다. → DB 수정 파일: `supabase/migrations/20261118000009_email_auth.sql` (Supabase에 실행 완료)

## 남은 일 (다음에 이어서)
1. **Vercel 환경변수 확인**: 배포 사이트가 Supabase 키를 읽지 못하고 있습니다.
   - Vercel → realhave → Settings → Environment Variables에 아래 두 이름이 정확히 있는지, Production이 체크되어 있는지 확인합니다.
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - 확인 후 Deployments → ⋯ → **Redeploy**를 누릅니다.
   - 해결 확인: 로그아웃 상태에서 홈의 "상품등록"을 누르면 로그인 화면으로 이동하면 됩니다.
2. **Supabase 이메일 설정 확인** (Authentication 메뉴)
   - Confirm email 켜기
   - Email OTP Length 6
   - 메일 템플릿 2개 교체: `docs/email-templates/` 폴더의 파일 사용
   - Site URL: `https://realhave.vercel.app`
   - Redirect URLs: `http://localhost:3000/**`
3. **4단계 테스트**: 가입 → 메일 코드 → 마이페이지 닉네임 표시 → 로그아웃 → 상품등록 누르면 로그인 화면 → 비밀번호 찾기
4. 이후 **5단계**: 홈 · 카테고리 · A-Z · 검색 · 상품목록 · 상품상세

## 내 PC에서 실행하는 법
- 폴더 `C:\dev\realhave`에서 `npm run dev`를 실행한 뒤 브라우저로 http://localhost:3000 에 접속합니다.
- 비밀키 파일 `.env.local`은 이 폴더에만 있고, GitHub에는 올라가지 않습니다.

## 참고
- 바탕화면의 예전 `OneDrive\Desktop\REALHAVE` 폴더는 더 이상 쓰지 않습니다. 확인 후 지우셔도 됩니다.
- Supabase 기본 메일은 시간당 발송량이 적습니다. 오픈 전에 메일 발송 서비스를 연결해야 합니다.
