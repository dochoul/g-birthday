import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

/**
 * 주민등록번호에서 생일(YYYY-MM-DD)을 추출한다.
 */
export function extractBirthday(idNumber: string): string | null {
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

/**
 * 엑셀 버퍼에서 주민등록번호 컬럼을 제거하고 생일 컬럼을 추가한 버퍼를 반환한다.
 * 이미 생일 컬럼이 있고 주민등록번호가 없으면 원본 버퍼를 그대로 반환한다.
 */
export function sanitizeExcelBuffer(buffer: Buffer): Buffer {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  if (rows.length === 0 || !('주민등록번호' in rows[0])) return buffer;

  const sanitizedRows = rows.map((row) => {
    const idNumber = String(row['주민등록번호'] || '');
    const birthday = extractBirthday(idNumber) || '';
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(row)) {
      if (key === '주민등록번호') {
        result['생일'] = birthday;
      } else {
        result[key] = row[key];
      }
    }
    return result;
  });

  const newSheet = XLSX.utils.json_to_sheet(sanitizedRows);
  const newWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(newWorkbook, newSheet, sheetName);
  return Buffer.from(XLSX.write(newWorkbook, { type: 'buffer', bookType: 'xlsx' }));
}

/**
 * 파일을 읽어 주민등록번호를 제거한 버전으로 덮어쓴다.
 */
export function sanitizeExcelFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const buffer = fs.readFileSync(filePath);
  const sanitized = sanitizeExcelBuffer(buffer);
  if (sanitized !== buffer) {
    fs.writeFileSync(filePath, sanitized);
    console.log(`[Sanitize] 주민등록번호 제거 완료: ${path.basename(filePath)}`);
  }
}

/**
 * DATA_DIR 내 모든 엑셀 파일(메인 + 백업)에서 주민등록번호를 제거한다.
 */
export function migrateAllExcelFiles(dataDir: string): void {
  const mainFile = path.join(dataDir, 'gabia_birthday.xlsx');
  sanitizeExcelFile(mainFile);

  const backupDir = path.join(dataDir, 'backups');
  if (fs.existsSync(backupDir)) {
    fs.readdirSync(backupDir)
      .filter((f) => f.endsWith('.xlsx'))
      .forEach((f) => sanitizeExcelFile(path.join(backupDir, f)));
  }
}
