# gabia-birthday

가비아 생일자 관리 사내 웹 애플리케이션입니다.

매달 생일 직원에게 기프티콘을 지급하는 업무를 지원하기 위해, 엑셀 명부 기반으로 월별 생일자 목록을 관리하고, HR API 휴직원 정보를 연동하여 기프티콘 지급 대상자를 정확히 필터링합니다.

---

## 주요 기능

### 생일자 목록 조회
- 월별 생일자 목록 조회 (1~12월 선택 가능)
- 이름, 상태, 고용형태, 생일(MM-DD) 표시
- 생일일 기준 오름차순 정렬
- **기프티콘 미지급 대상자 시각화**
  - 🎂 재직중 정규직 (기프티콘 지급 대상)
  - ⛱️ 휴직중 (비활성화 표시)
  - 🌱 수습 (비활성화 표시)
  - 🔥 퇴직예정자 (비활성화 표시)

### 통계 페이지
- 상단 요약 카드: 전체/재직중/수습/휴직중/퇴직예정 직원 수
- 휴직/수습/퇴직예정 직원 명단 (생일 포함)
- 월별 생일자 현황 차트 (Stacked Bar Chart)

### 엑셀 다운로드
- 지정 월의 **기프티콘 지급 대상자만** 엑셀로 내보내기
- 제외 대상: 휴직중, 수습, 퇴직예정자
- 타이틀 행 포함 (`2026년 4월 생일자 명단`)

### 명부 업로드
- 관리자가 엑셀 명부를 업로드하여 데이터 갱신
- 업로드 이력 관리 (업로드자, 일시, 파일명)

### 인증
- Hiworks OAuth 2.0 PKCE 로그인
- 사내 직원만 접근 가능

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| **모노레포** | npm workspaces (`client/` + `server/`) |
| **프론트엔드** | React 18, TypeScript, Vite, Mantine v8, TanStack React Query v5, Axios |
| **백엔드** | Express 4, TypeScript, ExcelJS, xlsx |
| **인증** | Hiworks OAuth 2.0 PKCE |
| **데이터** | 엑셀 명부 + HR API 휴직원 연동 |
| **데스크톱** | Electron (선택적 빌드) |

---

## 프로젝트 구조

```
gabia-birthday/
├── package.json                        # 모노레포 루트 (npm workspaces)
├── README.md
│
├── client/                             # 프론트엔드
│   ├── package.json
│   ├── vite.config.ts                  # 개발 서버 + API 프록시 (/api → :3001)
│   └── src/
│       ├── main.tsx                    # MantineProvider + QueryClientProvider
│       ├── App.tsx                     # 라우팅: /, /stats, /upload, /auth/callback
│       ├── api/client.ts               # API 클라이언트 + 타입 정의
│       ├── contexts/AuthContext.tsx    # 인증 상태 관리
│       ├── components/
│       │   ├── Header.tsx              # 상단바: 네비게이션 + 로그아웃
│       │   └── RequireAuth.tsx         # 인증 가드
│       └── pages/
│           ├── BirthdayListPage.tsx    # 생일자 목록 + 엑셀 다운로드
│           ├── StatsPage.tsx           # 통계 + 차트 + 명단
│           ├── UploadPage.tsx          # 명부 업로드
│           └── AuthCallback.tsx        # OAuth 콜백 처리
│
├── server/                             # 백엔드
│   ├── package.json
│   ├── .env                            # 환경변수 (git 제외)
│   ├── .env.example                    # 환경변수 템플릿
│   ├── data/
│   │   └── gabia_birthday.xlsx         # 생일자 명부 (git 제외)
│   └── src/
│       ├── index.ts                    # Express 서버 엔트리포인트
│       ├── routes/
│       │   ├── auth.ts                 # OAuth 로그인/토큰교환/세션/로그아웃
│       │   ├── birthdays.ts            # 생일자 API (목록/통계/요약/내보내기)
│       │   └── upload.ts               # 명부 업로드 API
│       └── services/
│           ├── hiworksService.ts       # OAuth PKCE, 토큰 교환/갱신
│           ├── hrService.ts            # HR API 휴직원 조회
│           └── birthdayExcelService.ts # 엑셀 파싱, 통계, 필터링
│
└── electron/                           # Electron 메인 프로세스 (선택적)
    └── main.js
```

---

## 데이터 흐름

### 생일자 목록 조회
```
[브라우저] → GET /api/birthdays?month=4
                ↓
[Express 서버] → 세션에서 access_token 확인
                ↓ (병렬)
        ┌───────┴────────┐
        ↓                ↓
[엑셀 명부]        [HR API /v1/leave-employees]
 생일자 목록         휴직원 목록
        └───────┬────────┘
                ↓
      이름 매칭으로 휴직 여부 반영
                ↓
[브라우저] ← { data: [...], month: 4, count: N }
```

### 엑셀 데이터 형식

| 컬럼 | 설명 | 예시 |
|------|------|------|
| 번호 | 순번 | 1, 2, 3... |
| 이름 | 국문(영문) 형식 | 허다인(Diane) |
| 주민등록번호 | 생년월일+성별 (마스킹) | 850312-1 |
| 상태 | 재직중/휴직중/퇴직예정자 | 재직중 |
| 고용형태 | 정규직/수습 | 정규직 |

### 기프티콘 지급 대상 판정 로직

```
기프티콘 대상 = 상태 === '재직중'
             AND 고용형태 === '정규직'
             AND HR API 휴직원 목록에 없음

제외 대상:
- 휴직중 (엑셀 상태 OR HR API)
- 수습 (고용형태)
- 퇴직예정자 (상태)
```

---

## API 엔드포인트

### 인증
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/auth/login` | OAuth 로그인 URL 반환 |
| POST | `/api/auth/exchange` | OAuth 코드 → 토큰 교환 |
| GET | `/api/auth/me` | 로그인 사용자 정보 |
| POST | `/api/auth/logout` | 로그아웃 |

### 생일자
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/birthdays?month=N` | 월별 생일자 목록 (휴직 여부 포함) |
| GET | `/api/birthdays/stats` | 1~12월 월별 통계 |
| GET | `/api/birthdays/summary` | 전체 요약 + 휴직/수습/퇴직예정 명단 |
| GET | `/api/birthdays/export?month=N` | 엑셀 다운로드 (기프티콘 대상자만) |

### 업로드
| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/upload` | 명부 엑셀 업로드 |
| GET | `/api/upload/history` | 업로드 이력 조회 |

---

## 시작하기

### 1. 환경변수 설정

```bash
cp server/.env.example server/.env
```

`server/.env` 파일 편집:

```env
HIWORKS_CLIENT_ID=<발급받은 클라이언트 ID>
HIWORKS_CLIENT_SECRET=<발급받은 클라이언트 시크릿>
HIWORKS_AUTH_URL=https://auth-api.gabiaoffice.hiworks.com
HIWORKS_ACCOUNT_API_URL=https://account-api.gabiaoffice.hiworks.com
HIWORKS_HR_API_URL=https://hr-api.gabiaoffice.hiworks.com
HIWORKS_REDIRECT_URI=http://localhost:5173/auth/callback
FRONTEND_URL=http://localhost:5173
```

### 2. 생일자 명부 준비

`server/data/gabia_birthday.xlsx` 파일을 준비하거나, 앱 실행 후 업로드 페이지에서 업로드합니다.

### 3. 설치 및 실행

```bash
npm install
npm run dev
```

- 프론트엔드: http://localhost:5173
- 백엔드: http://localhost:3001

### 4. 사용

1. 브라우저에서 http://localhost:5173 접속
2. "하이웍스로 로그인" 버튼 클릭 → Hiworks OAuth 인증
3. 이번 달 생일자 목록 확인
4. 상단 메뉴로 통계/업로드 페이지 이동

---

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 프론트엔드 + 백엔드 동시 개발 서버 실행 |
| `npm run dev:client` | 프론트엔드만 실행 |
| `npm run dev:server` | 백엔드만 실행 |
| `npm run build` | 프로덕션 빌드 |
| `npm run build:electron` | Electron 빌드 준비 |
| `npm run package:mac` | macOS DMG 패키징 |
| `npm run package:win` | Windows 설치파일 패키징 |

---

## 아이콘 범례

| 아이콘 | 의미 | 기프티콘 |
|--------|------|----------|
| 🎂 | 재직중 정규직 | O |
| ⛱️ | 휴직중 | X |
| 🌱 | 수습 | X |
| 🔥 | 퇴직예정자 | X |

---

## 중복 처리

- **엑셀 이름 중복**: 동일 이름이 여러 행에 있으면 첫 번째만 사용
- **HR API 휴직원 중복**: 동일인이 여러 휴직(출산휴가+육아휴직)으로 등록된 경우 `user_no` 기준 한 번만 처리
- **이름 매칭**: 엑셀 `국문(영문)` ↔ HR API `영문(국문)` 형식에서 한글 이름 추출하여 비교
