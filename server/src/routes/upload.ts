import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';
import { getSessionFromCookie } from './auth';
import { sanitizeExcelBuffer, sanitizeExcelFile } from '../utils/sanitizeExcel';

const router = Router();

// DATA_DIR: Electron에서는 userData, 개발 시에는 server/data
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const EXCEL_PATH = path.join(DATA_DIR, 'gabia_birthday.xlsx');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const HISTORY_PATH = path.join(DATA_DIR, 'upload_history.json');

// 샘플 파일: Electron 패키징 시 extraResources에 포함됨
function getSamplePath(): string {
  // Electron 패키징 환경
  if (process.env.NODE_ENV === 'production' && (process as any).resourcesPath) {
    return path.join((process as any).resourcesPath, 'server/data/sample_birthday.xlsx');
  }
  // 개발 환경
  return path.join(__dirname, '../../data/sample_birthday.xlsx');
}

interface UploadHistoryEntry {
  timestamp: string;
  fileName: string;
  count: number;
  정규직: number;
  정규직수습: number;
  인턴: number;
}

function readHistory(): UploadHistoryEntry[] {
  try {
    if (fs.existsSync(HISTORY_PATH)) {
      return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8'));
    }
  } catch {}
  return [];
}

function appendHistory(entry: UploadHistoryEntry) {
  const history = readHistory();
  history.unshift(entry);
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history.slice(0, 100), null, 2));
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx') {
      cb(null, true);
    } else {
      cb(new Error('.xlsx 파일만 업로드 가능합니다.'));
    }
  },
});

/**
 * POST /api/upload/excel
 * gabia_birthday.xlsx를 교체한다. 기존 파일은 백업으로 보관.
 */
router.post('/excel', upload.single('file'), (req: Request, res: Response) => {
  const session = getSessionFromCookie(req);
  if (!session) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: '파일이 없습니다.' });
  }

  try {
    // xlsx 유효성 검증
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    if (rows.length === 0) {
      return res.status(400).json({ error: '엑셀 파일이 비어 있습니다.' });
    }

    const hasIdColumn = '주민등록번호' in rows[0];
    const hasBirthdayColumn = '생일' in rows[0];
    const requiredColumns = ['이름(호칭)', '사번', '소속', '이메일', '상태'];
    const missingColumns = requiredColumns.filter((col) => !(col in rows[0]));
    if (missingColumns.length > 0 || (!hasIdColumn && !hasBirthdayColumn)) {
      const missing = [
        ...missingColumns,
        ...(!hasIdColumn && !hasBirthdayColumn ? ['주민등록번호 또는 생일'] : []),
      ];
      return res.status(400).json({ error: `필수 컬럼이 없습니다: ${missing.join(', ')}` });
    }

    // 주민등록번호 즉시 제거: 생일만 추출하여 저장
    const sanitizedBuffer = sanitizeExcelBuffer(req.file.buffer);

    // 기존 파일 백업
    if (fs.existsSync(EXCEL_PATH)) {
      if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const backupPath = path.join(BACKUP_DIR, `gabia_birthday_${timestamp}.xlsx`);
      fs.copyFileSync(EXCEL_PATH, backupPath);
      sanitizeExcelFile(backupPath); // 백업 파일에도 주민등록번호 잔존 시 즉시 제거

      // 백업 파일 최대 10개 유지
      const backups = fs.readdirSync(BACKUP_DIR).sort();
      if (backups.length > 10) {
        fs.unlinkSync(path.join(BACKUP_DIR, backups[0]));
      }
    }

    // 새 파일 저장 (주민등록번호 제거된 버전)
    fs.writeFileSync(EXCEL_PATH, sanitizedBuffer);

    const 정규직 = rows.filter((r) => r['고용형태'] === '정규직').length;
    const 정규직수습 = rows.filter((r) => r['고용형태'] === '정규직-수습').length;
    const 인턴 = rows.filter((r) => r['고용형태'] === '인턴').length;

    appendHistory({
      timestamp: new Date().toISOString(),
      fileName: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
      count: rows.length,
      정규직,
      정규직수습,
      인턴,
    });

    console.log(`[Upload] 엑셀 파일 업로드 완료. (총 ${rows.length}명 / 정규직 ${정규직}, 정규직-수습 ${정규직수습}, 인턴 ${인턴})`);
    res.json({ message: '업로드 완료', count: rows.length });
  } catch (error: any) {
    console.error('Excel upload failed:', error.message);
    res.status(500).json({ error: '파일 처리 중 오류가 발생했습니다.' });
  }
});

/**
 * GET /api/upload/history
 * 업로드 이력을 반환한다.
 */
router.get('/history', (req: Request, res: Response) => {
  const session = getSessionFromCookie(req);
  if (!session) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }
  res.json({ data: readHistory() });
});

/**
 * GET /api/upload/sample
 * 샘플 엑셀 파일을 다운로드한다.
 */
router.get('/sample', (req: Request, res: Response) => {
  const samplePath = getSamplePath();
  if (!fs.existsSync(samplePath)) {
    return res.status(404).json({ error: '샘플 파일이 없습니다.' });
  }
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="sample_birthday.xlsx"');
  res.sendFile(samplePath);
});

export default router;
