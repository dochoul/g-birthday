# gabia-birthday

가비아 이번 달 생일자 목록을 조회하는 사내 웹 애플리케이션입니다.

매달 생일 직원에게 상품권을 지급하는 업무를 지원하기 위해, Hiworks HR API에서 직원 데이터를 가져와 월별 생일자 목록을 테이블로 보여줍니다.

---

## 주요 기능

- Hiworks OAuth 2.0 PKCE 로그인
- 월별 생일자 목록 조회 (1~12월 선택 가능)
- 생일자의 이름, 부서(상위 조직 경로 포함), 생일(MM-DD) 표시
- 생일일 기준 오름차순 정렬

## 기술 스택

| 구분 | 기술 |
|------|------|
| **모노레포** | npm workspaces (`client/` + `server/`) |
| **프론트엔드** | React 18, TypeScript, Vite, Mantine v8, TanStack React Query v5, Axios |
| **백엔드** | Express 4, TypeScript |
| **인증** | Hiworks OAuth 2.0 PKCE |
| **데이터** | Hiworks HR API 실시간 조회 (DB 없음) |

## 프로젝트 구조

```
gabia-birthday/
├── package.json                        # 모노레포 루트 (npm workspaces)
├── .gitignore
├── README.md
│
├── client/                             # 프론트엔드
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts                  # 개발 서버 + API 프록시 (/api → :3001)
│   ├── index.html
│   └── src/
│       ├── main.tsx                    # MantineProvider + QueryClientProvider
│       ├── App.tsx                     # 라우팅: /, /auth/callback
│       ├── index.css                   # 기본 스타일
│       ├── assets/logo-gabia.svg
│       ├── api/client.ts               # Axios 인스턴스, auth API, getBirthdays()
│       ├── types/birthday.ts           # BirthdayEmployee, AccountMeInfo 등 타입
│       ├── contexts/AuthContext.tsx     # 인증 상태 관리 (로그인/로그아웃)
│       ├── components/
│       │   ├── Header.tsx              # 상단바: 로고 + "생일자 관리" + 로그아웃
│       │   ├── Header.module.css
│       │   └── RequireAuth.tsx         # 미인증 시 로그인 유도
│       └── pages/
│           ├── BirthdayListPage.tsx     # 메인 페이지: 월 선택 + 생일자 테이블
│           └── AuthCallback.tsx         # OAuth 콜백 처리
│
└── server/                             # 백엔드
    ├── package.json
    ├── tsconfig.json
    ├── .env                            # 환경변수 (git 제외)
    ├── .env.example                    # 환경변수 템플릿
    └── src/
        ├── index.ts                    # Express 서버 엔트리포인트
        ├── routes/
        │   ├── auth.ts                 # OAuth 로그인/토큰교환/세션/로그아웃
        │   └── birthdays.ts            # GET /api/birthdays?month=N
        └── services/
            ├── hiworksService.ts       # OAuth PKCE, 토큰 교환, 토큰 갱신, 사용자 정보 조회
            └── hrService.ts            # HR API 직원 조회 + 조직 트리 조회 + 생일 필터링
```

## 데이터 흐름

```
[브라우저] → GET /api/birthdays?month=4
                ↓
[Express 서버] → 세션에서 access_token 확인
                ↓ (병렬 호출)
        ┌───────┴────────┐
        ↓                ↓
[HR API /v2/users]  [HR API /v2/organizations]
  직원 목록 + 생일      조직 트리 (node_id → 부서명)
        └───────┬────────┘
                ↓
      월별 필터링 + 부서명 매핑 + 일자순 정렬
                ↓
[브라우저] ← { data: [...], month: 4, count: 2 }
```

### 사용하는 Hiworks API

| API | 용도 |
|-----|------|
| `GET /v2/users?search_type=member&filter[office_no]=1&filter[org_tree_request]=Y&page[limit]=999999` | 전체 직원 목록 (생일 포함) |
| `GET /v2/organizations?filter[structure]=tree` | 조직 트리 (node_id → 부서명 매핑) |
| `GET /accounts/me` | 로그인 사용자 정보 |

### 서버가 필요한 이유

OAuth access_token은 보안을 위해 서버 세션에만 저장됩니다(`httpOnly` 쿠키). 브라우저 JS에서는 토큰에 접근할 수 없으므로, 서버가 HR API를 대신 호출하는 프록시 역할을 합니다.

## 시작하기

### 1. 환경변수 설정

```bash
cp server/.env.example server/.env
```

`server/.env` 파일을 열어 Hiworks OAuth 클라이언트 정보를 입력합니다:

```env
HIWORKS_CLIENT_ID=<발급받은 클라이언트 ID>
HIWORKS_CLIENT_SECRET=<발급받은 클라이언트 시크릿>
HIWORKS_AUTH_URL=https://auth-api.gabiaoffice.hiworks.com
HIWORKS_ACCOUNT_API_URL=https://account-api.gabiaoffice.hiworks.com
HIWORKS_HR_API_URL=https://hr-api.gabiaoffice.hiworks.com
HIWORKS_REDIRECT_URI=http://localhost:5173/auth/callback
FRONTEND_URL=http://localhost:5173
```

### 2. 설치 및 실행

```bash
npm install
npm run dev
```

- 프론트엔드: http://localhost:5173
- 백엔드: http://localhost:3001

### 3. 사용

1. 브라우저에서 http://localhost:5173 접속
2. "하이웍스로 로그인" 버튼 클릭 → Hiworks OAuth 인증
3. 로그인 후 이번 달 생일자 목록이 테이블로 표시됨
4. 상단 드롭다운으로 다른 월의 생일자 조회 가능

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 프론트엔드 + 백엔드 동시 개발 서버 실행 |
| `npm run dev:client` | 프론트엔드만 실행 |
| `npm run dev:server` | 백엔드만 실행 |
| `npm run build` | 프로덕션 빌드 |

## 향후 계획

- 상품권 지급 이력 관리 (DB 추가)
- 지급 완료 체크 기능
- 엑셀 내보내기
