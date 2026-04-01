import * as XLSX from 'xlsx';
import path from 'path';

export interface BirthdayEmployee {
  name: string;
  birthday: string; // YYYY-MM-DD
  employmentType: string;
  status: string;
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
}

export function fetchMonthlyStats(): MonthlyStat[] {
  const filePath = path.join(__dirname, '../../data/gabia_birthday.xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<{ 주민등록번호: string; 상태: string; 고용형태: string }>(sheet);

  const stats: MonthlyStat[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    재직중: 0,
    수습: 0,
    휴직중: 0,
  }));

  rows.forEach((row) => {
    const birthday = extractBirthday(String(row.주민등록번호 || ''));
    if (!birthday) return;
    const monthIdx = parseInt(birthday.split('-')[1]) - 1;
    if (monthIdx < 0 || monthIdx >= 12) return;

    if (row.상태 === '휴직중') {
      stats[monthIdx].휴직중++;
    } else if (row.고용형태 === '수습') {
      stats[monthIdx].수습++;
    } else {
      stats[monthIdx].재직중++;
    }
  });

  return stats;
}

/**
 * 엑셀 파일에서 지정 월의 생일자 목록을 반환한다. (일자 오름차순)
 */
export function fetchBirthdayEmployeesFromExcel(month: number): BirthdayEmployee[] {
  const filePath = path.join(__dirname, '../../data/gabia_birthday.xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<{ 이름: string; 주민등록번호: string; 상태: string; 고용형태: string }>(sheet);

  const monthStr = String(month).padStart(2, '0');

  return rows
    .map((row) => ({
      name: row.이름 || '',
      birthday: extractBirthday(String(row.주민등록번호 || '')),
      employmentType: row.고용형태 || '',
      status: row.상태 || '',
    }))
    .filter((emp): emp is BirthdayEmployee => {
      if (!emp.birthday) return false;
      return emp.birthday.split('-')[1] === monthStr;
    })
    .sort((a, b) => {
      const dayA = parseInt(a.birthday.split('-')[2]);
      const dayB = parseInt(b.birthday.split('-')[2]);
      return dayA - dayB;
    });
}
