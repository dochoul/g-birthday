# Gabia Birthday

가비아 임직원 생일 관리 데스크톱 앱 (Electron)

매달 생일 직원에게 기프티콘을 지급하는 업무를 지원하기 위해, 인사팀 엑셀 명부를 기반으로 월별 생일자 목록을 관리하고 지급 대상자를 필터링합니다.

---

## 주요 기능

- **월별 생일자 조회** — 월 선택 시 생일자 목록 표시 (생일 오름차순 정렬)
- **엑셀 내보내기** — 선택 월 생일자를 팀/유닛 분리 형태의 `.xlsx`로 다운로드
- **직원 명부 업로드** — 인사팀 엑셀 파일을 드래그&드롭 또는 클릭으로 업로드
- **업로드 내역** — 업로드 일시, 파일명, 고용형태별 인원 수 기록
- **월별 통계 차트** — 고용형태별(정규직/정규직-수습/인턴/휴직중) 생일자 막대 차트
- **직원 명단** — 정규직-수습, 인턴, 휴직중 직원 명단 및 생일 표시
- **개인정보 보호** — 업로드 즉시 주민등록번호 삭제, 생일(YYYY-MM-DD)만 보관

---

## 다운로드

| 플랫폼 | 파일 | 설명 |
|--------|------|------|
| macOS (Apple Silicon) | `Gabia Birthday-1.0.1-arm64.dmg` | DMG 설치 파일 |
| Windows (설치) | `Gabia Birthday Setup 1.0.1.exe` | NSIS 설치 파일 |
| Windows (포터블) | `Gabia Birthday 1.0.1.exe` | 설치 없이 바로 실행 |

빌드된 파일은 `dist-electron/` 폴더에 있습니다.

---

## 설치 및 실행

### macOS

1. `Gabia Birthday-1.0.1-arm64.dmg` 실행
2. `Gabia Birthday.app`을 `/Applications` 폴더로 드래그
3. 앱 실행

> 처음 실행 시 "확인되지 않은 개발자" 경고가 뜰 수 있습니다.
> **시스템 설정 > 개인 정보 보호 및 보안 > 보안** 에서 "확인 없이 열기"를 클릭하세요.

### Windows (설치 파일)

1. `Gabia Birthday Setup 1.0.1.exe` 실행
2. 설치 경로 선택 후 설치 완료
3. 시작 메뉴 또는 바탕화면에서 실행

> 이전 버전이 설치되어 있다면 새 Setup.exe 실행 시 자동으로 업그레이드됩니다.

### Windows (포터블)

1. `Gabia Birthday 1.0.1.exe`를 원하는 폴더에 저장
2. 더블클릭으로 바로 실행 (설치 불필요, 제어판 등록 없음)
3. 업데이트 시 새 파일로 교체하면 됩니다

---

## 직원 명부 엑셀 형식

업로드할 엑셀 파일(`.xlsx`)에 아래 컬럼이 반드시 포함되어야 합니다.

| 컬럼명 | 필수 여부 | 설명 |
|--------|----------|------|
| 이름(호칭) | O | 예: `김민준`, `Diane(허다인)`, `허다인(Diane)` |
| 사번 | O | 직원 사번 |
| 소속 | O | 팀>유닛 형식 권장. 예: `개발팀>백엔드유닛` |
| 생일 | O* | `YYYY-MM-DD` 형식 |
| 주민등록번호 | O* | 생일 컬럼 없을 때 대체 사용 (업로드 즉시 삭제) |
| 이메일 | O | 사내 이메일 주소 |
| 상태 | O | `재직중` 또는 `휴직중` |
| 고용형태 | O | `정규직`, `정규직-수습`, `인턴` 중 하나 |

> `생일` 또는 `주민등록번호` 중 하나는 반드시 있어야 합니다.
> 주민등록번호는 업로드 즉시 생일만 추출 후 삭제되며, 저장 파일 어디에도 남지 않습니다.

샘플 파일은 앱 내 **직원 명부 업로드 > 샘플 파일 다운로드** 버튼에서 받을 수 있습니다.

---

## 엑셀 내보내기 형식

생일자 목록을 내보내면 아래 컬럼으로 구성된 `.xlsx` 파일이 생성됩니다.

| 번호 | 이름 | 팀 | 유닛 | 생일 | 고용형태 |

- 파일명: `{연도}년_{월}월_생일자.xlsx`
- 정규직-수습, 인턴, 휴직중인 직원은 별도 색상으로 구분

---

## 기프티콘 지급 대상

| 고용형태 / 상태 | 지급 여부 | UI 표시 |
|----------------|----------|---------|
| 정규직 (재직중) | O | 활성화 |
| 정규직-수습 (재직중) | X | 비활성화 |
| 인턴 (재직중) | X | 비활성화 |
| 휴직중 | X | 비활성화 |

---

## 개인정보 보호

- 업로드된 파일에서 **주민등록번호 컬럼은 즉시 삭제**되며 생일(YYYY-MM-DD)만 저장됩니다.
- 백업 파일에도 동일하게 적용됩니다.
- 앱 시작 시 기존 파일에 주민등록번호가 남아있으면 자동으로 마이그레이션합니다.
- API 응답, 화면, 엑셀 내보내기 어디에도 주민등록번호가 포함되지 않습니다.
- 백업 파일은 최대 10개까지 보관됩니다.

---

## 데이터 저장 위치

앱 데이터는 OS별 사용자 데이터 디렉토리에 저장됩니다.

| OS | 경로 |
|----|------|
| macOS | `~/Library/Application Support/gabia-birthday/` |
| Windows | `%APPDATA%\gabia-birthday\` |

---

## 개발 환경 실행

### 요구사항

- Node.js 18 이상
- npm 9 이상

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (브라우저)
npm run dev

# Electron 앱으로 실행
npm run electron:dev
```

- 프론트엔드: http://localhost:5173
- 백엔드: http://localhost:3001

### 빌드

```bash
# macOS DMG (arm64)
npm run dist:mac

# Windows 설치 파일 (NSIS, x64)
npm run dist:win

# Windows 포터블 (x64)
npm run dist:win:portable

# Mac + Windows 동시 빌드
npm run dist:all
```

---

## 프로젝트 구조

```
gabia-birthday/
├── package.json                        # 모노레포 루트 (npm workspaces)
├── electron/
│   └── main.js                         # Electron 메인 프로세스
│
├── client/                             # 프론트엔드
│   └── src/
│       ├── api/client.ts               # API 클라이언트 + 타입 정의
│       ├── pages/
│       │   ├── BirthdayListPage.tsx    # 생일자 목록 + 엑셀 다운로드
│       │   ├── StatsPage.tsx           # 통계 차트 + 직원 명단
│       │   └── UploadPage.tsx          # 명부 업로드 + 업로드 내역
│       └── components/
│           └── Header.tsx              # 상단 네비게이션
│
└── server/                             # 백엔드
    ├── data/
    │   ├── gabia_birthday.xlsx         # 생일자 명부 (git 제외)
    │   ├── sample_birthday.xlsx        # 샘플 파일
    │   ├── upload_history.json         # 업로드 이력
    │   └── backups/                    # 자동 백업 (최대 10개)
    └── src/
        ├── routes/
        │   ├── birthdays.ts            # 생일자 API
        │   └── upload.ts               # 명부 업로드 API
        ├── services/
        │   └── birthdayExcelService.ts # 엑셀 파싱, 통계, 필터링
        └── utils/
            └── sanitizeExcel.ts        # 주민등록번호 제거 유틸
```

---

## API 엔드포인트

### 생일자

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/birthdays?month=N` | 월별 생일자 목록 |
| GET | `/api/birthdays/stats` | 1~12월 고용형태별 통계 |
| GET | `/api/birthdays/summary` | 전체 요약 + 고용형태별 명단 |
| GET | `/api/birthdays/export?month=N` | 생일자 엑셀 내보내기 |

### 업로드

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/upload/excel` | 명부 엑셀 업로드 |
| GET | `/api/upload/history` | 업로드 이력 조회 |
| GET | `/api/upload/sample` | 샘플 엑셀 다운로드 |

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 데스크톱 | Electron 35, electron-builder |
| 프론트엔드 | React 18, TypeScript, Vite, Mantine v8, TanStack Query v5 |
| 백엔드 | Express 4, TypeScript |
| 엑셀 처리 | xlsx, ExcelJS |
| 빌드 | esbuild |

---

## 버전 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0.1 | 2026-04-03 | 샘플 파일 다운로드 버그 수정 (Electron 환경에서 외부 브라우저 오픈 문제) |
| 1.0.0 | 2026-04-03 | 최초 릴리즈 |
