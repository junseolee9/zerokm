# CLAUDE.md

## 앱 실행

```bash
npm run dev   # localhost:3000, .env.local 필요 (.env.local.example 참조)
npm run build
npm run check:rls   # RLS 격리 검증 (라이브 Supabase + 테스트 계정 2개 필요)
```

## 아키텍처

멀티테넌트 장거리 커플 앱. 한 배포에 여러 커플, 커플당 하나의 "space".
`time_zone_clock/nextjs-app`에서 일반화해 파생 (원본은 별도 운영, 서로 독립).

**스택:** Next.js 14 (App Router) + TypeScript + Supabase (Auth·Postgres·Storage) → Vercel

**핵심 원칙 — 변경 시 반드시 지킬 것:**
- 격리는 오직 RLS. 브라우저가 anon key + 유저 세션으로 Supabase 직접 질의. **service-role 키를 앱에 절대 도입하지 말 것.**
- 사람은 행(row)이다. `entries(space_id, date, member_id)` — 사람별 컬럼 금지.
- 사람별 색은 CSS 변수 `--pc` 하나로. 사람별 CSS 클래스 만들지 말 것.
- 인증은 Google OAuth 단일. 매칭은 `members.invited_email` = 로그인한 Google 이메일, `claim_invite()` RPC 안에서만 비교 (클라이언트 입력 불신).
- space/member 행 생성은 `create_space`/`claim_invite` RPC로만 (security definer). 클라이언트에 insert 권한 없음.
- 사진 버킷 `photos`는 비공개. DB에는 `photo_path`만 저장, URL은 렌더 시 `createSignedUrl`. signed URL을 DB에 저장 금지 (만료됨).

**구조:**
- `supabase/schema.sql` — DB 전체 (테이블·RLS·RPC·storage 정책), 멱등, dashboard SQL editor에서 실행
- `lib/queries.ts` — 모든 데이터 접근 (브라우저 측)
- `lib/supabase/{client,server}.ts` — @supabase/ssr 클라이언트 팩토리
- `middleware.ts` — 세션 갱신 + 로그인 가드; 공간 미소속 → `/onboarding` 리디렉트는 `app/page.tsx`에서
- `app/api/notify`, `app/api/invite` — 서버 route 둘뿐 (파트너 알림·초대 메일, Gmail SMTP, 옵션)
- `scripts/check-rls.ts` — 크로스 스페이스 격리 assert
