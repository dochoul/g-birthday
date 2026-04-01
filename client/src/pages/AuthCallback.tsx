import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Card } from '@mantine/core';
import { exchangeOAuthCode } from '../api/client';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const exchanged = useRef(false);

  useEffect(() => {
    if (exchanged.current) return;
    exchanged.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      setError('인증 정보가 올바르지 않습니다.');
      return;
    }

    exchangeOAuthCode(code, state)
      .then(async () => {
        await queryClient.invalidateQueries({ queryKey: ['accountMe'] });
        navigate('/', { replace: true });
      })
      .catch((err) => {
        console.error('OAuth code exchange failed:', err);
        if (err.response?.status === 403) {
          setError('접근 권한이 없습니다. 관리자에게 문의하세요.');
        } else {
          setError('하이웍스 인증에 실패했습니다. 다시 시도해주세요.');
        }
      });
  }, [searchParams, navigate, queryClient]);

  if (error) {
    return (
      <div className="page-container">
        <Card shadow="sm" padding="xl" radius="md" withBorder style={{ maxWidth: 640, margin: '0 auto' }}>
          <h1 className="form-title">인증 실패</h1>
          <p className="form-subtitle">{error}</p>
          <button onClick={() => navigate('/', { replace: true })} style={{ marginTop: 16 }}>
            돌아가기
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Card shadow="sm" padding="xl" radius="md" withBorder style={{ maxWidth: 640, margin: '0 auto' }}>
        <p className="form-subtitle">하이웍스 로그인 처리 중...</p>
      </Card>
    </div>
  );
}
