import axios from 'axios';
import type { AccountMeInfo, BirthdayResponse } from '../types/birthday';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// --- OAuth 인증 API ---

export async function getOAuthLoginUrl(): Promise<{ authUrl: string; state: string }> {
  const { data } = await api.get<{ authUrl: string; state: string }>('/auth/login');
  return data;
}

export async function exchangeOAuthCode(code: string, state: string): Promise<AccountMeInfo> {
  const { data } = await api.post<{ user: AccountMeInfo }>('/auth/exchange', { code, state });
  return data.user;
}

export async function getAccountMeInfo(): Promise<AccountMeInfo> {
  const { data } = await api.get<{ data: AccountMeInfo }>('/auth/me');
  return data.data;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

// --- Birthday API ---

export async function getBirthdays(month: number): Promise<BirthdayResponse> {
  const { data } = await api.get<BirthdayResponse>('/birthdays', { params: { month } });
  return data;
}

export interface MonthlyStat {
  month: number;
  재직중: number;
  수습: number;
  휴직중: number;
}

export async function getBirthdayStats(): Promise<MonthlyStat[]> {
  const { data } = await api.get<{ data: MonthlyStat[] }>('/birthdays/stats');
  return data.data;
}

export interface UploadHistoryEntry {
  timestamp: string;
  uploaderName: string;
  uploaderId: string;
  count: number;
  fileName: string;
}

export async function getUploadHistory(): Promise<UploadHistoryEntry[]> {
  const { data } = await api.get<{ data: UploadHistoryEntry[] }>('/upload/history');
  return data.data;
}

export async function exportBirthdaysExcel(month: number): Promise<void> {
  const response = await api.get('/birthdays/export', {
    params: { month },
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  const year = new Date().getFullYear();
  link.setAttribute('download', `${year}년_${month}월_생일자.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
