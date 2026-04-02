import https from 'https';

export interface BirthdayEmployee {
  user_no: number;
  name: string;
  birthday: string;
  department: string;
}

/** HTTPS GET 요청 헬퍼 */
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
          if (res.statusCode !== 200) {
            return reject(new Error(`API failed (${res.statusCode}): ${data}`));
          }
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error('Failed to parse API response'));
          }
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('API request timed out'));
    });
    req.end();
  });
}

/**
 * 조직 트리를 평탄화하여 node_id → 부서 경로 매핑을 만든다.
 * 루트(가비아) 제외, 상위 부서 포함 (예: "경영지원팀 > 인사유닛")
 */
function flattenOrgTree(node: any, map: Map<number, string>, ancestors: string[] = []) {
  const path = node.node_name ? [...ancestors, node.node_name] : ancestors;
  if (node.node_id && node.node_name) {
    // 루트(depth 1) 제외하고 경로 표시
    const display = path.slice(1).join(' > ');
    map.set(node.node_id, display || node.node_name);
  }
  if (node.child && Array.isArray(node.child)) {
    for (const child of node.child) {
      flattenOrgTree(child, map, path);
    }
  }
}

/**
 * HR API에서 전체 직원 + 조직 트리를 조회한 후,
 * 지정 월의 생일자만 필터링하여 부서명과 함께 반환한다.
 */
export async function fetchBirthdayEmployees(accessToken: string, month: number): Promise<BirthdayEmployee[]> {
  const hrApiUrl = new URL(process.env.HIWORKS_HR_API_URL!);

  // 직원 목록 + 조직 트리 병렬 조회
  const [usersJson, orgJson] = await Promise.all([
    httpsGet(hrApiUrl.hostname, '/v2/users?search_type=member&filter[office_no]=1&filter[org_tree_request]=Y&page[limit]=999999', accessToken),
    httpsGet(hrApiUrl.hostname, '/v2/organizations?filter[structure]=tree', accessToken),
  ]);

  // 조직 트리 → node_id → 부서명 매핑
  const deptMap = new Map<number, string>();
  const orgData = orgJson.data ?? orgJson;
  if (orgData) {
    flattenOrgTree(orgData, deptMap);
  }

  const users = usersJson.data ?? usersJson;
  if (!Array.isArray(users)) return [];

  // 생일 월 기준 필터링
  const monthStr = String(month).padStart(2, '0');
  const birthdayUsers = users
    .filter((user) => {
      const info = user.user_info ?? user;
      const birthday = info.birthday || '';
      if (!birthday || birthday.length < 7) return false;
      return birthday.split('-')[1] === monthStr;
    })
    .map((user) => {
      const info = user.user_info ?? user;
      const nodeId = user.node?.node_id ?? 0;
      return {
        user_no: info.master_user_no || 0,
        name: info.name || '',
        birthday: info.birthday || '',
        department: deptMap.get(nodeId) || '',
      };
    })
    .sort((a, b) => {
      const dayA = parseInt(a.birthday.split('-')[2] || '0');
      const dayB = parseInt(b.birthday.split('-')[2] || '0');
      return dayA - dayB;
    });

  return birthdayUsers;
}

export interface LeaveEmployee {
  user_no: number;
  name: string;       // 예: "Diane(허다인)"
  koreanName: string; // 예: "허다인"
}

/**
 * HR API에서 휴직원 목록을 조회한다.
 * name에서 한글 이름을 추출하여 koreanName 필드에 저장한다.
 * 동일인이 여러 휴직(출산휴가+육아휴직 등)으로 중복 등록된 경우 한 번만 반환한다.
 */
export async function fetchLeaveEmployees(accessToken: string): Promise<LeaveEmployee[]> {
  const hrApiUrl = new URL(process.env.HIWORKS_HR_API_URL!);
  const result = await httpsGet(hrApiUrl.hostname, '/v1/leave-employees', accessToken);
  
  const data = result.data ?? result;
  if (!Array.isArray(data)) return [];

  // 중복 제거를 위한 Map (user_no 기준)
  const uniqueMap = new Map<number, LeaveEmployee>();

  data.forEach((emp: any) => {
    const userNo = emp.user_no || 0;
    if (uniqueMap.has(userNo)) return; // 이미 추가된 사람은 스킵

    const name = emp.name || '';
    // "Diane(허다인)" → "허다인" 추출
    const match = name.match(/\(([^)]+)\)/);
    const koreanName = match ? match[1] : name;
    
    uniqueMap.set(userNo, {
      user_no: userNo,
      name,
      koreanName,
    });
  });

  return [...uniqueMap.values()];
}
