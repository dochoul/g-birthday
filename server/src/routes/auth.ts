import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  exchangeCodeForTokens,
  refreshAccessToken,
  fetchAccountMe,
} from '../services/hiworksService';
import type { AccountMeInfo } from '../services/hiworksService';

const router = Router();

// --- 세션 저장소 (인메모리) ---

interface Session {
  accessToken: string;
  refreshToken: string;
  userInfo: AccountMeInfo;
  expiresAt: number; // Unix timestamp (ms)
}

export const sessions = new Map<string, Session>();

// PKCE 상태 임시 저장 (state → codeVerifier)
interface PendingAuth {
  codeVerifier: string;
  createdAt: number;
}

const pendingAuths = new Map<string, PendingAuth>();

// 5분 후 만료된 pending auth 정리
setInterval(() => {
  const now = Date.now();
  for (const [state, pending] of pendingAuths) {
    if (now - pending.createdAt > 5 * 60 * 1000) {
      pendingAuths.delete(state);
    }
  }
}, 60 * 1000);

// 만료된 세션 정리
setInterval(() => {
  const now = Date.now();
  for (const [sid, session] of sessions) {
    // refresh token도 만료됐으면 세션 삭제 (24시간 여유)
    if (now - session.expiresAt > 24 * 60 * 60 * 1000) {
      sessions.delete(sid);
    }
  }
}, 10 * 60 * 1000);

function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

const GUEST_SESSION: Session = {
  accessToken: '',
  refreshToken: '',
  userInfo: {
    user_id: 'local',
    name: '로컬 사용자',
    address: '',
    cell: '',
    nodes: [],
  },
  expiresAt: Infinity,
};

export function getSessionFromCookie(req: Request): Session | null {
  const sid = req.cookies?.birthday_sid;
  if (!sid) return GUEST_SESSION;
  return sessions.get(sid) ?? GUEST_SESSION;
}

// --- 라우트 ---

/**
 * GET /api/auth/login
 * OAuth 인증 URL을 생성하여 반환한다. 프론트엔드에서 이 URL로 리다이렉트한다.
 */
router.get('/login', (_req: Request, res: Response) => {
  const clientId = process.env.HIWORKS_CLIENT_ID!;
  const authBaseUrl = process.env.HIWORKS_AUTH_URL!;
  const redirectUri = process.env.HIWORKS_REDIRECT_URI!;

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // PKCE 상태 저장
  pendingAuths.set(state, { codeVerifier, createdAt: Date.now() });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read write',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  const authUrl = `${authBaseUrl}/oauth/authorize?${params.toString()}`;
  res.json({ authUrl, state });
});

/**
 * POST /api/auth/exchange
 * 프론트엔드에서 받은 authorization code를 토큰으로 교환한다.
 * Body: { code: string, state: string }
 */
router.post('/exchange', async (req: Request, res: Response) => {
  const { code, state } = req.body;

  if (!code || !state) {
    return res.status(400).json({ error: 'code와 state가 필요합니다.' });
  }

  // PKCE code_verifier 조회
  const pending = pendingAuths.get(state);
  if (!pending) {
    return res.status(400).json({ error: '유효하지 않거나 만료된 state입니다. 다시 로그인해주세요.' });
  }
  pendingAuths.delete(state);

  try {
    // 1. 토큰 교환
    const tokens = await exchangeCodeForTokens(code, pending.codeVerifier);

    // 2. 사용자 정보 조회
    const userInfo = await fetchAccountMe(tokens.access_token);

    // 3. 접근 허용 여부 확인
    const allowedIds = (process.env.ALLOWED_USER_IDS || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (allowedIds.length > 0 && !allowedIds.includes(userInfo.user_id)) {
      console.warn(`[Auth] 접근 거부: ${userInfo.user_id} (${userInfo.name})`);
      return res.status(403).json({ error: '접근 권한이 없습니다. 관리자에게 문의하세요.' });
    }

    // 4. 세션 생성
    const sid = generateSessionId();
    sessions.set(sid, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      userInfo,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    });

    // 4. 세션 쿠키 설정
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('birthday_sid', sid, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24시간
      path: '/',
    });

    res.json({ user: userInfo });
  } catch (error: any) {
    console.error('OAuth exchange failed:', error.message);
    res.status(401).json({ error: '하이웍스 인증에 실패했습니다. 다시 로그인해주세요.' });
  }
});

/**
 * GET /api/auth/me
 * 현재 로그인된 사용자 정보를 반환한다.
 * 토큰이 만료된 경우 자동으로 갱신한다.
 */
router.get('/me', async (req: Request, res: Response) => {
  const sid = req.cookies?.birthday_sid;
  if (!sid) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }

  const session = sessions.get(sid);
  if (!session) {
    return res.status(401).json({ error: '세션이 만료되었습니다. 다시 로그인해주세요.' });
  }

  // 토큰 만료 임박 시 (5분 전) 자동 갱신
  if (Date.now() > session.expiresAt - 5 * 60 * 1000) {
    try {
      const tokens = await refreshAccessToken(session.refreshToken);
      session.accessToken = tokens.access_token;
      session.refreshToken = tokens.refresh_token;
      session.expiresAt = Date.now() + tokens.expires_in * 1000;

      // 사용자 정보도 갱신
      session.userInfo = await fetchAccountMe(tokens.access_token);
    } catch (error: any) {
      console.error('Token refresh failed:', error.message);
      sessions.delete(sid);
      res.clearCookie('birthday_sid');
      return res.status(401).json({ error: '세션이 만료되었습니다. 다시 로그인해주세요.' });
    }
  }

  res.json({ data: session.userInfo });
});

/**
 * POST /api/auth/logout
 * 세션을 삭제하고 쿠키를 제거한다.
 */
router.post('/logout', (req: Request, res: Response) => {
  const sid = req.cookies?.birthday_sid;
  if (sid) {
    sessions.delete(sid);
  }
  res.clearCookie('birthday_sid');
  res.json({ message: '로그아웃 되었습니다.' });
});

export default router;
