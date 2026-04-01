import https from 'https';
import crypto from 'crypto';

/** account-api /accounts/me 응답과 동일한 구조 */
export interface AccountMeInfo {
  user_id: string;
  name: string;
  address: string;
  cell: string;
  nodes: { id: number; name: string; full_name: string }[];
}

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

// --- PKCE 유틸리티 ---

export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export function generateState(): string {
  return crypto.randomBytes(16).toString('hex');
}

// --- OAuth 토큰 교환 ---

export function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<OAuthTokens> {
  const clientId = process.env.HIWORKS_CLIENT_ID!;
  const clientSecret = process.env.HIWORKS_CLIENT_SECRET || '';
  const redirectUri = process.env.HIWORKS_REDIRECT_URI!;
  const authUrl = new URL(process.env.HIWORKS_AUTH_URL!);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
    ...(clientSecret && { client_secret: clientSecret }),
  }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: authUrl.hostname,
        path: '/oauth/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`Token exchange failed (${res.statusCode}): ${data}`));
          }
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error('Failed to parse token response'));
          }
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Token exchange timed out'));
    });
    req.write(body);
    req.end();
  });
}

// --- 토큰 갱신 ---

export function refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
  const clientId = process.env.HIWORKS_CLIENT_ID!;
  const authUrl = new URL(process.env.HIWORKS_AUTH_URL!);

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: authUrl.hostname,
        path: '/oauth/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`Token refresh failed (${res.statusCode}): ${data}`));
          }
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error('Failed to parse refresh response'));
          }
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Token refresh timed out'));
    });
    req.write(body);
    req.end();
  });
}

// --- 사용자 정보 조회 (account-api with Bearer token) ---

export function fetchAccountMe(accessToken: string): Promise<AccountMeInfo> {
  const accountApiUrl = new URL(process.env.HIWORKS_ACCOUNT_API_URL!);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: accountApiUrl.hostname,
        path: '/accounts/me',
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
            return reject(new Error(`Account API failed (${res.statusCode}): ${data}`));
          }
          try {
            const json = JSON.parse(data);
            // account-api는 { data: {...} } 형태로 감싸서 응답할 수 있음
            const info = json.data ?? json;
            resolve({
              user_id: info.user_id || '',
              name: info.name || '',
              address: info.address || '',
              cell: info.cell || '',
              nodes: info.nodes || [],
            });
          } catch {
            reject(new Error('Failed to parse account API response'));
          }
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Account API request timed out'));
    });
    req.end();
  });
}
