import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import authRouter from './routes/auth';
import birthdaysRouter from './routes/birthdays';
import uploadRouter from './routes/upload';
import { migrateAllExcelFiles } from './utils/sanitizeExcel';

// 필수 환경변수 검증
const requiredEnvVars = ['HIWORKS_CLIENT_ID', 'HIWORKS_AUTH_URL', 'HIWORKS_ACCOUNT_API_URL', 'HIWORKS_REDIRECT_URI', 'HIWORKS_HR_API_URL'];
const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
if (missingVars.length > 0) {
  console.error(`\n[ERROR] 필수 환경변수가 설정되지 않았습니다: ${missingVars.join(', ')}`);
  console.error(`server/.env.example을 참고하여 server/.env 파일을 생성해주세요.\n`);
  process.exit(1);
}

const app = express();
const PORT = 3001;

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/birthdays', birthdaysRouter);
app.use('/api/upload', uploadRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// 프로덕션: 프론트엔드 정적 파일 서빙
const publicDir = path.join(__dirname, '../public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  // 기존 엑셀 파일에 주민등록번호가 남아있다면 즉시 제거
  const dataDir = process.env.DATA_DIR || path.join(__dirname, '../data');
  migrateAllExcelFiles(dataDir);
});

export default app;
