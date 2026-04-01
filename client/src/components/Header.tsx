import { Link, useLocation } from 'react-router-dom';
import { Group, Button } from '@mantine/core';
import logoGabia from '../assets/logo-gabia.svg';
import classes from './Header.module.css';
import { useAuth } from '../contexts/AuthContext';

const links = [
  { link: '/', label: '🎂 생일자 목록' },
  { link: '/stats', label: '📊 월별 통계' },
  { link: '/upload', label: '📂 명부 업로드' },
];

export default function Header() {
  const { accountInfo, logout } = useAuth();
  const { pathname } = useLocation();

  return (
    <header className={classes.header}>
      <div className={classes.inner}>
        <Link to="/" className={classes.logo}>
          <img src={logoGabia} alt="Gabia" />
          🎉 생일자 관리
        </Link>
        <Group gap={5}>
          {accountInfo && links.map((item) => (
            <Link
              key={item.link}
              to={item.link}
              className={`${classes.link} ${pathname === item.link ? classes.linkActive : ''}`}
            >
              {item.label}
            </Link>
          ))}
          {accountInfo && (
            <Button variant="subtle" size="compact-sm" onClick={logout}>
              {accountInfo.name} 로그아웃
            </Button>
          )}
        </Group>
      </div>
    </header>
  );
}
