/**
 * 임시 스크립트: 휴직원 목록 조회
 * 실행: npx ts-node scripts/fetch-leave-employees.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import https from 'https';

dotenv.config({ path: path.join(__dirname, '../.env') });

// 서버 세션 Map에서 토큰을 가져올 수 없으므로,
// 서버의 세션 파일이나 환경변수에서 토큰을 직접 주입하거나
// /api/auth/me 엔드포인트의 쿠키를 사용해야 합니다.
// 아래에 브라우저에서 복사한 Bearer 토큰을 직접 입력하거나,
// 서버의 세션 저장소에서 읽어오는 방식으로 사용합니다.

const ACCESS_TOKEN = process.env.DEBUG_ACCESS_TOKEN || '';

function httpsGet(hostname: string, path: string, accessToken: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname,
        path,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          console.log(`HTTP ${res.statusCode}`);
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.end();
  });
}

async function main() {
  if (!ACCESS_TOKEN) {
    console.error('ACCESS_TOKEN이 없습니다. 서버에서 세션 토큰을 추출합니다...');

    // 서버 내부 세션 Map을 직접 import해서 사용
    // (같은 프로세스가 아니므로 불가 → 서버에 엔드포인트 추가 필요)
    // 대신 서버의 /api/debug/session-token 엔드포인트를 호출합니다.
    const tokenResult: any = await new Promise((resolve, reject) => {
      const req = require('http').request(
        { hostname: 'localhost', port: 3001, path: '/api/debug/session-token', method: 'GET' },
        (res: any) => {
          let d = '';
          res.on('data', (c: any) => (d += c));
          res.on('end', () => {
            try { resolve(JSON.parse(d)); } catch { resolve({ error: d }); }
          });
        }
      );
      req.on('error', reject);
      req.end();
    });

    if (tokenResult.error || !tokenResult.accessToken) {
      console.error('토큰 추출 실패:', tokenResult);
      process.exit(1);
    }

    const token = tokenResult.accessToken;
    console.log('[세션에서 토큰 획득 성공]');
    await fetchAndPrint(token);
  } else {
    await fetchAndPrint(ACCESS_TOKEN);
  }
}

async function fetchAndPrint(token: string) {
  console.log('\n휴직원 목록 조회 중...\n');
  const result = await httpsGet('hr-api.gabiaoffice.hiworks.com', '/v1/leave-employees', token);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
