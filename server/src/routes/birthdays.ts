import { Router, Request, Response } from 'express';
import { getSessionFromCookie } from './auth';
import * as XLSX from 'xlsx';
import { fetchBirthdayEmployeesFromExcel, fetchMonthlyStats } from '../services/birthdayExcelService';

const router = Router();

/**
 * GET /api/birthdays?month=N
 * 지정 월의 생일 직원 목록을 반환한다. (기본값: 현재 월)
 */
router.get('/', (req: Request, res: Response) => {
  const session = getSessionFromCookie(req);
  if (!session) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }

  const monthParam = req.query.month as string | undefined;
  const month = monthParam ? parseInt(monthParam, 10) : new Date().getMonth() + 1;

  if (isNaN(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: '유효하지 않은 월입니다. (1-12)' });
  }

  try {
    const employees = fetchBirthdayEmployeesFromExcel(month);
    res.json({ data: employees, month, count: employees.length });
  } catch (error: any) {
    console.error('Failed to read birthday Excel:', error.message);
    res.status(500).json({ error: '생일자 목록을 가져오는데 실패했습니다.' });
  }
});

/**
 * GET /api/birthdays/stats
 * 1~12월 월별 생일자 수를 반환한다.
 */
router.get('/stats', (req: Request, res: Response) => {
  const session = getSessionFromCookie(req);
  if (!session) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }

  try {
    const stats = fetchMonthlyStats();
    res.json({ data: stats });
  } catch (error: any) {
    console.error('Failed to read birthday stats:', error.message);
    res.status(500).json({ error: '통계 데이터를 가져오는데 실패했습니다.' });
  }
});

/**
 * GET /api/birthdays/export?month=N
 * 지정 월의 생일자 중 재직중이고 수습이 아닌 직원만 엑셀로 반환한다.
 */
router.get('/export', (req: Request, res: Response) => {
  const session = getSessionFromCookie(req);
  if (!session) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }

  const monthParam = req.query.month as string | undefined;
  const month = monthParam ? parseInt(monthParam, 10) : new Date().getMonth() + 1;

  if (isNaN(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: '유효하지 않은 월입니다. (1-12)' });
  }

  try {
    const employees = fetchBirthdayEmployeesFromExcel(month).filter(
      (emp) => emp.status === '재직중' && emp.employmentType !== '수습',
    );

    const rows = employees.map((emp, idx) => ({
      번호: idx + 1,
      이름: emp.name,
      고용형태: emp.employmentType,
      생일: emp.birthday.slice(5),
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 6 }, { wch: 16 }, { wch: 12 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, `${month}월 생일자`);

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const year = new Date().getFullYear();
    const filename = encodeURIComponent(`${year}년_${month}월_생일자.xlsx`);

    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error: any) {
    console.error('Failed to export birthday Excel:', error.message);
    res.status(500).json({ error: '엑셀 내보내기에 실패했습니다.' });
  }
});

export default router;
