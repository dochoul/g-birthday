import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';
import { getSessionFromCookie } from './auth';

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
  uploaderName: string;
  uploaderId: string;
  count: number;
  fileName: string;
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

    const requiredColumns = ['이름(호칭)', '사번', '소속', '주민등록번호', '이메일', '상태'];
    const firstRow = rows[0];
    const missingColumns = requiredColumns.filter((col) => !(col in firstRow));
    if (missingColumns.length > 0) {
      return res.status(400).json({ error: `필수 컬럼이 없습니다: ${missingColumns.join(', ')}` });
    }

    // 기존 파일 백업
    if (fs.existsSync(EXCEL_PATH)) {
      if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const backupPath = path.join(BACKUP_DIR, `gabia_birthday_${timestamp}.xlsx`);
      fs.copyFileSync(EXCEL_PATH, backupPath);

      // 백업 파일 최대 10개 유지
      const backups = fs.readdirSync(BACKUP_DIR).sort();
      if (backups.length > 10) {
        fs.unlinkSync(path.join(BACKUP_DIR, backups[0]));
      }
    }

    // 새 파일 저장
    fs.writeFileSync(EXCEL_PATH, req.file.buffer);

    appendHistory({
      timestamp: new Date().toISOString(),
      uploaderName: session.userInfo.name,
      uploaderId: String(session.userInfo.user_id),
      count: rows.length,
      fileName: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
    });

    console.log(`[Upload] ${session.userInfo.name}(${session.userInfo.user_id})이 엑셀 파일을 업로드했습니다. (${rows.length}명)`);
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
