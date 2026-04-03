import { Router, Request, Response } from 'express';
import { getSessionFromCookie } from './auth';
import ExcelJS from 'exceljs';
import { fetchBirthdayEmployeesFromExcel, fetchMonthlyStats, fetchEmployeeSummary } from '../services/birthdayExcelService';

const router = Router();

/**
 * GET /api/birthdays?month=N
 * 지정 월의 생일 직원 목록을 반환한다. (기본값: 현재 월)
 */
router.get('/', async (req: Request, res: Response) => {
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
router.get('/stats', async (req: Request, res: Response) => {
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
 * GET /api/birthdays/summary
 * 전체 직원 요약 통계 (휴직중 명단 포함)
 */
router.get('/summary', async (req: Request, res: Response) => {
  const session = getSessionFromCookie(req);
  if (!session) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }

  try {
    const summary = fetchEmployeeSummary();
    res.json({ data: summary });
  } catch (error: any) {
    console.error('Failed to read employee summary:', error.message);
    res.status(500).json({ error: '요약 데이터를 가져오는데 실패했습니다.' });
  }
});

/**
 * GET /api/birthdays/export?month=N
 * 지정 월의 생일자 중 재직중인 직원만 엑셀로 반환한다.
 */
router.get('/export', async (req: Request, res: Response) => {
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
    const employees = fetchBirthdayEmployeesFromExcel(month).filter((emp) => emp.status === '재직중');

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`${month}월 생일자`);

    ws.columns = [
      { key: 'no', width: 8 },
      { key: 'name', width: 18 },
      { key: 'department', width: 24 },
      { key: 'birthday', width: 12 },
    ];

    const year = new Date().getFullYear();
    ws.mergeCells('A1:D1');
    const titleCell = ws.getCell('A1');
    titleCell.value = `${year}년 ${month}월 생일자 명단`;
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 36;

    ws.addRow([]);

    const headerRow = ws.addRow(['번호', '이름', '소속', '생일']);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      };
    });

    employees.forEach((emp, idx) => {
      const [, mm, dd] = emp.birthday.split('-');
      const birthday = `${parseInt(mm)}월 ${parseInt(dd)}일`;
      const row = ws.addRow({ no: idx + 1, name: emp.name, department: emp.department, birthday });
      row.eachCell((cell) => {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD0D7E2' } },
          left: { style: 'thin', color: { argb: 'FFD0D7E2' } },
          bottom: { style: 'thin', color: { argb: 'FFD0D7E2' } },
          right: { style: 'thin', color: { argb: 'FFD0D7E2' } },
        };
      });
      row.height = 22;
    });

    const buffer = await wb.xlsx.writeBuffer();
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
