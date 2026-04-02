import * as XLSX from 'xlsx';
import path from 'path';

export interface BirthdayEmployee {
  name: string;
  birthday: string; // YYYY-MM-DD
  employmentType: string;
  status: string;
  isOnLeave?: boolean; // HR API 휴직원 여부
}

/**
 * 이름에서 한글 이름을 추출한다.
 * "Diane(허다인)" → "허다인" (영문(국문) 형식)
 * "허다인(Diane)" → "허다인" (국문(영문) 형식)
 * "김민준" → "김민준" (국문만)
 */
function extractKoreanName(name: string): string {
  // 괄호 안의 내용 추출
  const match = name.match(/\(([^)]+)\)/);
  if (match) {
    const inParen = match[1];
    const beforeParen = name.split('(')[0].trim();
    // 괄호 안이 한글로만 구성되면 그것을 반환 (영문(국문) 형식)
    if (/^[가-힣]+$/.test(inParen)) {
      return inParen;
    }
    // 괄호 앞이 한글로 시작하면 그것을 반환 (국문(영문) 형식)
    if (/^[가-힣]/.test(beforeParen)) {
      return beforeParen;
    }
  }
  return name;
}

/**
 * 주민등록번호에서 생일(YYYY-MM-DD)을 추출한다.
 * 7번째 자리: 1,2 → 1900년대 / 3,4 → 2000년대
 */
function extractBirthday(idNumber: string): string | null {
  const cleaned = idNumber.replace(/[-\s]/g, '');
  if (cleaned.length < 7) return null;

  const yy = cleaned.slice(0, 2);
  const mm = cleaned.slice(2, 4);
  const dd = cleaned.slice(4, 6);
  const genderDigit = cleaned[6];

  let century: string;
  if (genderDigit === '1' || genderDigit === '2') {
    century = '19';
  } else if (genderDigit === '3' || genderDigit === '4') {
    century = '20';
  } else {
    return null;
  }

  return `${century}${yy}-${mm}-${dd}`;
}

/**
 * 엑셀 파일에서 1~12월 월별 생일자 수를 반환한다.
 */
export interface MonthlyStat {
  month: number;
  재직중: number;
  수습: number;
  휴직중: number;
  퇴직예정: number;
}

/**
 * 전체 직원 요약 통계 (휴직중/수습/퇴직예정 명단 포함)
 */
export interface EmployeeSummary {
  total: number;
  재직중: number;
  수습: number;
  휴직중: number;
  퇴직예정: number;
  수습명단: { name: string; birthday: string }[];
  휴직명단: { name: string; birthday: string }[];
  퇴직예정명단: { name: string; birthday: string }[];
}

type LeaveEmployeeRef = { name: string; koreanName: string; birthday?: string };

export function fetchMonthlyStats(leaveEmployeeList: LeaveEmployeeRef[] = []): MonthlyStat[] {
  const leaveNames = new Set(leaveEmployeeList.map((e) => e.koreanName));
  const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
  const filePath = path.join(dataDir, 'gabia_birthday.xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<{ 이름: string; 주민등록번호: string; 상태: string; 고용형태: string }>(sheet);

  const stats: MonthlyStat[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    재직중: 0,
    수습: 0,
    휴직중: 0,
    퇴직예정: 0,
  }));

  // 이름 중복 제거를 위한 Set
  const processedNames = new Set<string>();

  rows.forEach((row) => {
    const birthday = extractBirthday(String(row.주민등록번호 || ''));
    if (!birthday) return;
    const monthIdx = parseInt(birthday.split('-')[1]) - 1;
    if (monthIdx < 0 || monthIdx >= 12) return;

    const name = row.이름 || '';
    const koreanName = extractKoreanName(name);

    // 이미 처리된 이름이면 스킵
    if (processedNames.has(koreanName)) return;
    processedNames.add(koreanName);

    const isOnLeave = leaveNames.has(koreanName) || row.상태 === '휴직중';

    if (row.상태 === '퇴직예정자') {
      stats[monthIdx].퇴직예정++;
    } else if (isOnLeave) {
      stats[monthIdx].휴직중++;
    } else if (row.고용형태 === '수습') {
      stats[monthIdx].수습++;
    } else {
      stats[monthIdx].재직중++;
    }
  });

  // 엑셀에 없는 HR API 휴직자 추가 (생일 정보가 있을 때만 월별 통계에 반영)
  for (const leaveEmp of leaveEmployeeList) {
    if (!processedNames.has(leaveEmp.koreanName) && leaveEmp.birthday) {
      const monthIdx = parseInt(leaveEmp.birthday.split('-')[1]) - 1;
      if (monthIdx >= 0 && monthIdx < 12) {
        stats[monthIdx].휴직중++;
      }
      processedNames.add(leaveEmp.koreanName);
    }
  }

  return stats;
}

/**
 * 전체 직원 요약 통계를 반환한다.
 * 휴직중/수습/퇴직예정 직원의 명단과 생일 정보를 포함한다.
 * 동일 이름 중복은 제거한다.
 */
export function fetchEmployeeSummary(leaveEmployeeList: LeaveEmployeeRef[] = []): EmployeeSummary {
  const leaveNames = new Set(leaveEmployeeList.map((e) => e.koreanName));
  const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
  const filePath = path.join(dataDir, 'gabia_birthday.xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<{ 이름: string; 주민등록번호: string; 상태: string; 고용형태: string }>(sheet);

  const summary: EmployeeSummary = {
    total: 0,
    재직중: 0,
    수습: 0,
    휴직중: 0,
    퇴직예정: 0,
    수습명단: [],
    휴직명단: [],
    퇴직예정명단: [],
  };

  // 이름 중복 제거를 위한 Set
  const processedNames = new Set<string>();

  rows.forEach((row) => {
    const birthday = extractBirthday(String(row.주민등록번호 || ''));
    if (!birthday) return;

    const name = row.이름 || '';
    const koreanName = extractKoreanName(name);

    // 이미 처리된 이름이면 스킵
    if (processedNames.has(koreanName)) return;
    processedNames.add(koreanName);

    summary.total++;
    const isOnLeave = leaveNames.has(koreanName) || row.상태 === '휴직중';

    if (row.상태 === '퇴직예정자') {
      summary.퇴직예정++;
      summary.퇴직예정명단.push({ name, birthday });
    } else if (isOnLeave) {
      summary.휴직중++;
      summary.휴직명단.push({ name, birthday });
    } else if (row.고용형태 === '수습') {
      summary.수습++;
      summary.수습명단.push({ name, birthday });
    } else {
      summary.재직중++;
    }
  });

  // 엑셀에 없는 HR API 휴직자 추가
  for (const leaveEmp of leaveEmployeeList) {
    if (!processedNames.has(leaveEmp.koreanName)) {
      summary.total++;
      summary.휴직중++;
      summary.휴직명단.push({ name: leaveEmp.name, birthday: leaveEmp.birthday || '' });
      processedNames.add(leaveEmp.koreanName);
    }
  }

  // 생일 기준 정렬 (월-일)
  const sortByBirthday = (a: { birthday: string }, b: { birthday: string }) => {
    const [, am, ad] = a.birthday.split('-').map(Number);
    const [, bm, bd] = b.birthday.split('-').map(Number);
    return am !== bm ? am - bm : ad - bd;
  };
  summary.수습명단.sort(sortByBirthday);
  summary.휴직명단.sort(sortByBirthday);
  summary.퇴직예정명단.sort(sortByBirthday);

  return summary;
}

/**
 * 엑셀 파일에서 지정 월의 생일자 목록을 반환한다. (일자 오름차순, 이름 중복 제거)
 */
export function fetchBirthdayEmployeesFromExcel(month: number): BirthdayEmployee[] {
  const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
  const filePath = path.join(dataDir, 'gabia_birthday.xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<{ 이름: string; 주민등록번호: string; 상태: string; 고용형태: string }>(sheet);

  const monthStr = String(month).padStart(2, '0');
  const processedNames = new Set<string>();

  return rows
    .map((row) => ({
      name: row.이름 || '',
      birthday: extractBirthday(String(row.주민등록번호 || '')),
      employmentType: row.고용형태 || '',
      status: row.상태 || '',
    }))
    .filter((emp): emp is BirthdayEmployee => {
      if (!emp.birthday) return false;
      if (emp.birthday.split('-')[1] !== monthStr) return false;
      
      // 이름 중복 제거
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
