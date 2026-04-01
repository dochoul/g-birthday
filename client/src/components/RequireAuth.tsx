import { useAuth } from '../contexts/AuthContext';
import { Card, Button } from '@mantine/core';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { accountInfo, isLoading, login } = useAuth();

  if (isLoading) {
    return (
      <div className="page-container">
        <Card shadow="sm" padding="xl" radius="md" withBorder style={{ maxWidth: 640, margin: '0 auto' }}>
          <p className="form-subtitle">하이웍스 로그인 확인 중...</p>
        </Card>
      </div>
    );
  }

  if (!accountInfo) {
    return (
      <div className="page-container">
        <Card shadow="sm" padding="xl" radius="md" withBorder style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
          <h1 className="form-title">로그인 필요</h1>
          <p className="form-subtitle">이 페이지는 하이웍스 로그인이 필요합니다.</p>
          <Button onClick={login} size="lg" mt="md">
            하이웍스로 로그인
          </Button>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
