import * as XLSX from 'xlsx';
import path from 'path';

export interface BirthdayEmployee {
  name: string;
  employeeId: string;
  department: string;
  birthday: string; // YYYY-MM-DD
  email: string;
  status: string;
}

/**
 * 이름에서 한글 이름을 추출한다.
 * "Diane(허다인)" → "허다인" (영문(국문) 형식)
 * "허다인(Diane)" → "허다인" (국문(영문) 형식)
 * "김민준" → "김민준" (국문만)
 */
function extractKoreanName(name: string): string {
  const match = name.match(/\(([^)]+)\)/);
  if (match) {
    const inParen = match[1];
    const beforeParen = name.split('(')[0].trim();
    if (/^[가-힣]+$/.test(inParen)) {
      return inParen;
    }
    if (/^[가-힣]/.test(beforeParen)) {
      return beforeParen;
    }
  }
  return name;
}

/**
 * 주민등록번호에서 생일(YYYY-MM-DD)을 추출한다.
 * 7자리 이상: 7번째 자리(1,2 → 1900년대 / 3,4 → 2000년대)로 세기 판별
 * 6자리: yy >= 50이면 1900년대, 미만이면 2000년대로 판별
 */
function extractBirthday(idNumber: string): string | null {
  const cleaned = idNumber.replace(/[-\s]/g, '');
  if (cleaned.length < 6) return null;

  const yy = cleaned.slice(0, 2);
  const mm = cleaned.slice(2, 4);
  const dd = cleaned.slice(4, 6);

  let century: string;
  if (cleaned.length >= 7) {
    const genderDigit = cleaned[6];
    if (genderDigit === '1' || genderDigit === '2') {
      century = '19';
    } else if (genderDigit === '3' || genderDigit === '4') {
      century = '20';
    } else {
      return null;
    }
  } else {
    century = parseInt(yy) >= 50 ? '19' : '20';
  }

  return `${century}${yy}-${mm}-${dd}`;
}

function readExcelRows(filePath: string) {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<{ '이름(호칭)': string; 사번: string; 소속: string; 주민등록번호: string; 이메일: string; 상태: string }>(sheet);
}

function getDataDir() {
  return process.env.DATA_DIR || path.join(__dirname, '../../data');
}

/**
 * 엑셀 파일에서 1~12월 월별 생일자 수를 반환한다.
 */
export interface MonthlyStat {
  month: number;
  재직중: number;
  휴직중: number;
}

/**
 * 전체 직원 요약 통계 (휴직중 명단 포함)
 */
export interface EmployeeSummary {
  total: number;
  재직중: number;
  휴직중: number;
  휴직명단: { name: string; birthday: string }[];
}

export function fetchMonthlyStats(): MonthlyStat[] {
  const filePath = path.join(getDataDir(), 'gabia_birthday.xlsx');
  const rows = readExcelRows(filePath);

  const stats: MonthlyStat[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    재직중: 0,
    휴직중: 0,
  }));

  const processedNames = new Set<string>();

  rows.forEach((row) => {
    const birthday = extractBirthday(String(row.주민등록번호 || ''));
    if (!birthday) return;
    const monthIdx = parseInt(birthday.split('-')[1]) - 1;
    if (monthIdx < 0 || monthIdx >= 12) return;

    const koreanName = extractKoreanName(row['이름(호칭)'] || '');
    if (processedNames.has(koreanName)) return;
    processedNames.add(koreanName);

    if (row.상태 === '휴직중') {
      stats[monthIdx].휴직중++;
    } else {
      stats[monthIdx].재직중++;
    }
  });

  return stats;
}

export function fetchEmployeeSummary(): EmployeeSummary {
  const filePath = path.join(getDataDir(), 'gabia_birthday.xlsx');
  const rows = readExcelRows(filePath);

  const summary: EmployeeSummary = {
    total: 0,
    재직중: 0,
    휴직중: 0,
    휴직명단: [],
  };

  const processedNames = new Set<string>();

  rows.forEach((row) => {
    const birthday = extractBirthday(String(row.주민등록번호 || ''));
    if (!birthday) return;

    const name = row['이름(호칭)'] || '';
    const koreanName = extractKoreanName(name);
    if (processedNames.has(koreanName)) return;
    processedNames.add(koreanName);

    summary.total++;

    if (row.상태 === '휴직중') {
      summary.휴직중++;
      summary.휴직명단.push({ name, birthday });
    } else {
      summary.재직중++;
    }
  });

  const sortByBirthday = (a: { birthday: string }, b: { birthday: string }) => {
    const [, am, ad] = a.birthday.split('-').map(Number);
    const [, bm, bd] = b.birthday.split('-').map(Number);
    return am !== bm ? am - bm : ad - bd;
  };
  summary.휴직명단.sort(sortByBirthday);

  return summary;
}

/**
 * 엑셀 파일에서 지정 월의 생일자 목록을 반환한다. (일자 오름차순, 이름 중복 제거)
 */
export function fetchBirthdayEmployeesFromExcel(month: number): BirthdayEmployee[] {
  const filePath = path.join(getDataDir(), 'gabia_birthday.xlsx');
  const rows = readExcelRows(filePath);

  const monthStr = String(month).padStart(2, '0');
  const processedNames = new Set<string>();

  return rows
    .map((row) => ({
      name: row['이름(호칭)'] || '',
      employeeId: row.사번 || '',
      department: row.소속 || '',
      birthday: extractBirthday(String(row.주민등록번호 || '')),
      email: row.이메일 || '',
      status: row.상태 || '',
    }))
    .filter((emp): emp is BirthdayEmployee => {
      if (!emp.birthday) return false;
      if (emp.birthday.split('-')[1] !== monthStr) return false;

      const koreanName = extractKoreanName(emp.name);
      if (processedNames.has(koreanName)) return false;
      processedNames.add(koreanName);

      return true;
    })
    .sort((a, b) => {
      const dayA = parseInt(a.birthday.split('-')[2]);
      const dayB = parseInt(b.birthday.split('-')[2]);
      return dayA - dayB;
    });
}
