import https from 'https';
import { Router, Request, Response } from 'express';
import { getSessionFromCookie } from './auth';
import ExcelJS from 'exceljs';
import { fetchBirthdayEmployeesFromExcel, fetchMonthlyStats, fetchEmployeeSummary } from '../services/birthdayExcelService';
import { fetchLeaveEmployees } from '../services/hrService';

const router = Router();

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
 * GET /api/birthdays?month=N
 * 지정 월의 생일 직원 목록을 반환한다. (기본값: 현재 월)
 * HR API에서 휴직원 목록을 조회하여 isOnLeave 필드를 추가한다.
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
    // 엑셀에서 생일자 목록 조회
    const employees = fetchBirthdayEmployeesFromExcel(month);
    
    // HR API에서 휴직원 목록 조회
    let leaveNames: Set<string> = new Set();
    try {
      const leaveEmployees = await fetchLeaveEmployees(session.accessToken);
      leaveNames = new Set(leaveEmployees.map((e) => e.koreanName));
      console.log('[휴직원 목록]', [...leaveNames]);
    } catch (err: any) {
      console.warn('[휴직원 조회 실패]', err.message);
    }

    // 생일자에 휴직 여부 추가 (HR API 휴직원이면 status도 '휴직중'으로 변경)
    const employeesWithLeave = employees.map(emp => {
      const koreanName = extractKoreanName(emp.name);
      const isOnLeave = leaveNames.has(koreanName);
      return {
        ...emp,
        isOnLeave,
        status: isOnLeave ? '휴직중' : emp.status,
      };
    });

    res.json({ data: employeesWithLeave, month, count: employeesWithLeave.length });
  } catch (error: any) {
    console.error('Failed to read birthday Excel:', error.message);
    res.status(500).json({ error: '생일자 목록을 가져오는데 실패했습니다.' });
  }
});

/**
 * GET /api/birthdays/stats
 * 1~12월 월별 생일자 수를 반환한다. (HR API 휴직원 반영)
 */
router.get('/stats', async (req: Request, res: Response) => {
  const session = getSessionFromCookie(req);
  if (!session) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }

  try {
    // HR API에서 휴직원 목록 조회
    let leaveEmployees: Awaited<ReturnType<typeof fetchLeaveEmployees>> = [];
    try {
      leaveEmployees = await fetchLeaveEmployees(session.accessToken);
    } catch (err: any) {
      console.warn('[stats 휴직원 조회 실패]', err.message);
    }

    const stats = fetchMonthlyStats(leaveEmployees);
    res.json({ data: stats });
  } catch (error: any) {
    console.error('Failed to read birthday stats:', error.message);
    res.status(500).json({ error: '통계 데이터를 가져오는데 실패했습니다.' });
  }
});

/**
 * GET /api/birthdays/summary
 * 전체 직원 요약 통계 (휴직중/수습 명단 포함)
 */
router.get('/summary', async (req: Request, res: Response) => {
  const session = getSessionFromCookie(req);
  if (!session) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }

  try {
    // HR API에서 휴직원 목록 조회
    let leaveEmployees: Awaited<ReturnType<typeof fetchLeaveEmployees>> = [];
    try {
      leaveEmployees = await fetchLeaveEmployees(session.accessToken);
    } catch (err: any) {
      console.warn('[summary 휴직원 조회 실패]', err.message);
    }

    const summary = fetchEmployeeSummary(leaveEmployees);
    res.json({ data: summary });
  } catch (error: any) {
    console.error('Failed to read employee summary:', error.message);
    res.status(500).json({ error: '요약 데이터를 가져오는데 실패했습니다.' });
  }
});

/**
 * GET /api/birthdays/export?month=N
 * 지정 월의 생일자 중 재직중이고 수습이 아닌 직원만 엑셀로 반환한다.
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
    // HR API에서 휴직원 목록 조회
    let leaveNames: Set<string> = new Set();
    try {
      const leaveEmployees = await fetchLeaveEmployees(session.accessToken);
      leaveNames = new Set(leaveEmployees.map((e) => e.koreanName));
    } catch (err: any) {
      console.warn('[export 휴직원 조회 실패]', err.message);
    }

    // 재직중 + 수습 아닌 + 휴직 아닌 + 퇴직예정 아닌 직원만 필터링
    const employees = fetchBirthdayEmployeesFromExcel(month).filter((emp) => {
      const koreanName = extractKoreanName(emp.name);
      const isOnLeave = leaveNames.has(koreanName) || emp.status === '휴직중';
      return emp.status === '재직중' && emp.employmentType !== '수습' && !isOnLeave;
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`${month}월 생일자`);

    ws.columns = [
      { key: 'no', width: 8 },
      { key: 'name', width: 18 },
      { key: 'employmentType', width: 14 },
      { key: 'birthday', width: 12 },
    ];

    // 타이틀 행 추가
    const year = new Date().getFullYear();
    ws.mergeCells('A1:D1');
    const titleCell = ws.getCell('A1');
    titleCell.value = `${year}년 ${month}월 생일자 명단`;
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 36;

    // 빈 행 추가
    ws.addRow([]);

    // 헤더 행 추가 후 스타일 적용 (다크 네이비 배경, 흰색 볼드 텍스트)
    const headerRow = ws.addRow(['번호', '이름', '고용형태', '생일']);
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

    // 데이터 행
    employees.forEach((emp, idx) => {
      const [, mm, dd] = emp.birthday.split('-');
      const birthday = `${parseInt(mm)}월 ${parseInt(dd)}일`;
      const row = ws.addRow({ no: idx + 1, name: emp.name, employmentType: emp.employmentType, birthday });
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

/**
 * GET /api/birthdays/leave-employees
 * 휴직원 목록 조회
 */
router.get('/leave-employees', async (req: Request, res: Response) => {
  const session = getSessionFromCookie(req);
  if (!session) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }

  const hrApiUrl = new URL(process.env.HIWORKS_HR_API_URL!);

  try {
    const result = await new Promise<any>((resolve, reject) => {
      const request = https.request(
        {
          hostname: hrApiUrl.hostname,
          path: '/v1/leave-employees',
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            Accept: 'application/json',
          },
        },
        (r) => {
          let data = '';
          r.on('data', (chunk) => (data += chunk));
          r.on('end', () => {
            try { resolve(JSON.parse(data)); }
            catch { reject(new Error('Failed to parse response')); }
          });
        },
      );
      request.on('error', reject);
      request.setTimeout(15000, () => { request.destroy(); reject(new Error('timeout')); });
      request.end();
    });

    console.log('\n[leave-employees]');
    console.log(JSON.stringify(result, null, 2));

    res.json(result);
  } catch (error: any) {
    console.error('[leave-employees] error:', error.message);
    res.status(500).json({ error: error.message });
  }
});
