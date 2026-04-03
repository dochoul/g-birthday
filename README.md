# gabia-birthday

가비아 생일자 관리 사내 웹 애플리케이션입니다.

매달 생일 직원에게 기프티콘을 지급하는 업무를 지원하기 위해, 엑셀 명부 기반으로 월별 생일자 목록을 관리하고 기프티콘 지급 대상자를 필터링합니다.

---

## 주요 기능

### 생일자 목록 조회
- 월별 생일자 목록 조회 (1~12월 선택 가능)
- 이름, 사번, 소속, 상태, 이메일, 생일(MM-DD) 표시
- 생일일 기준 오름차순 정렬
- **기프티콘 미지급 대상자 시각화**
  - 🎂 재직중 (기프티콘 지급 대상)
  - ⛱️ 휴직중 (비활성화 표시)

### 통계 페이지
- 상단 요약 카드: 전체/재직중/휴직중 직원 수
- 휴직중 직원 명단 (생일 포함)
- 월별 생일자 현황 차트 (Stacked Bar Chart)

### 엑셀 다운로드
- 지정 월의 **기프티콘 지급 대상자만** 엑셀로 내보내기
- 제외 대상: 휴직중
- 타이틀 행 포함 (`2026년 4월 생일자 명단`)

### 명부 업로드
- 관리자가 엑셀 명부를 업로드하여 데이터 갱신
- 업로드 이력 관리 (업로드자, 일시, 파일명)

### 개인정보 보호
- 업로드 즉시 주민등록번호 컬럼 제거 — 생일(YYYY-MM-DD)만 추출하여 저장
- 기존 파일에 주민등록번호가 남아있으면 앱 시작 시 자동 마이그레이션
- API 응답, 화면, 엑셀 내보내기 어디에도 주민등록번호 미포함

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
| **데이터** | 엑셀 명부 |
| **데스크톱** | Electron + electron-builder |

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
                ↓
           [엑셀 명부]
            생일자 목록
                ↓
[브라우저] ← { data: [...], month: 4, count: N }
```

### 엑셀 데이터 형식

| 컬럼 | 설명 | 예시 |
|------|------|------|
| 이름(호칭) | 국문(영문) 형식 | 허다인(Diane) |
| 사번 | 직원 사번 | GW2301027 |
| 소속 | 팀 > 유닛 형식 | 개발팀 > 플랫폼유닛 |
| 주민등록번호 | 생년월일+성별 (**업로드 즉시 삭제**) | 850312-1234567 |
| 이메일 | 사내 이메일 | diane@gabia.com |
| 상태 | 재직중/휴직중 | 재직중 |

### 기프티콘 지급 대상 판정 로직

```
기프티콘 대상 = 상태 === '재직중'

제외 대상:
- 휴직중
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
| GET | `/api/birthdays?month=N` | 월별 생일자 목록 |
| GET | `/api/birthdays/stats` | 1~12월 월별 통계 |
| GET | `/api/birthdays/summary` | 전체 요약 + 휴직중 명단 |
| GET | `/api/birthdays/export?month=N` | 엑셀 다운로드 (재직중만) |

### 업로드
| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/upload/excel` | 명부 엑셀 업로드 |
| GET | `/api/upload/sample` | 샘플 엑셀 다운로드 |
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
| `npm run dist:mac` | macOS DMG 빌드 (arm64) |
| `npm run dist:win` | Windows 설치관리자 빌드 (NSIS, x64) |
| `npm run dist:win:portable` | Windows Portable exe 빌드 (설치 불필요, x64) |
| `npm run dist:all` | Mac + Windows 동시 빌드 |

---

## 데스크톱 앱 배포

### 왜 데스크톱 앱인가?

이 앱은 **주민등록번호가 포함된 엑셀 명부**를 다루므로 개인정보 보호가 중요합니다.

- 웹 서버에 배포하면 네트워크를 통해 개인정보가 전송됨
- 데스크톱 앱은 **로컬에서만 실행**되어 데이터가 외부로 유출되지 않음
- **특정 담당자만** 앱을 설치하여 사용 (접근 통제)
- 엑셀 파일은 사용자 PC에만 저장됨

### 빌드된 파일

| 플랫폼 | 파일 | 대상 | 특이사항 |
|--------|------|------|----------|
| Mac (Apple Silicon) | `Gabia Birthday-x.x.x-arm64.dmg` | M1/M2/M3/M4 Mac | 드래그 설치 |
| Windows 설치관리자 | `Gabia Birthday Setup x.x.x.exe` | Windows x64 | 제어판 등록, 업그레이드 시 자동 교체 |
| Windows Portable | `Gabia Birthday x.x.x.exe` | Windows x64 | 설치 없이 바로 실행, 파일 교체로 업데이트 |

빌드된 파일은 `dist-electron/` 폴더에 생성됩니다.

### 빌드 방법

```bash
# Mac + Windows 동시 빌드
npm run dist:all

# Mac만 빌드
npm run dist:mac

# Windows만 빌드
npm run dist:win
```

### 설치 및 실행

**Mac:**
1. DMG 파일 더블클릭
2. `Gabia Birthday.app`을 Applications 폴더로 드래그
3. Applications에서 앱 실행

**Windows (설치관리자):**
1. `Gabia Birthday Setup x.x.x.exe` 더블클릭
2. 설치 마법사 진행
3. 시작 메뉴 또는 바탕화면에서 앱 실행
4. 버전 업데이트 시 새 Setup.exe를 실행하면 기존 버전이 자동으로 교체됨

**Windows (Portable):**
1. `Gabia Birthday x.x.x.exe` 더블클릭 → 바로 실행
2. 설치 없음, 제어판 등록 없음
3. 업데이트 시 새 exe 파일로 교체하면 됨

---

## 아이콘 범례

| 아이콘 | 의미 | 기프티콘 |
|--------|------|----------|
| 🎂 | 재직중 | O |
| ⛱️ | 휴직중 | X |

---

## 중복 처리

- **엑셀 이름 중복**: 동일 이름이 여러 행에 있으면 첫 번째만 사용
- **이름 추출**: `국문(영문)` 또는 `영문(국문)` 형식 모두 지원, 한글 이름 기준으로 중복 제거
