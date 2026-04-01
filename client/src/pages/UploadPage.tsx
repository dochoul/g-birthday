import { useRef, useState } from 'react';
import { Card, Text, Button, Group, ThemeIcon, Stack, Alert, List, Table, Badge } from '@mantine/core';
import axios from 'axios';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { getUploadHistory } from '../api/client';

export default function UploadPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const { data: history = [], refetch: refetchHistory } = useQuery({
    queryKey: ['uploadHistory'],
    queryFn: getUploadHistory,
  });

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.xlsx')) {
      setStatus({ type: 'error', message: '.xlsx 파일만 업로드 가능합니다.' });
      return;
    }

    const confirmed = window.confirm(
      '📂 직원 명부 파일 업로드\n\n기존 파일은 자동으로 백업됩니다.\n새 파일로 교체하시겠습니까?'
    );
    if (!confirmed) return;

    setUploading(true);
    setStatus(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await axios.post<{ message: string; count: number }>(
        '/api/upload/excel',
        formData,
        { withCredentials: true }
      );
      setStatus({ type: 'success', message: `업로드 완료! 총 ${data.count}명의 데이터가 반영되었습니다.` });
      queryClient.invalidateQueries({ queryKey: ['birthdays'] });
      queryClient.invalidateQueries({ queryKey: ['birthdayStats'] });
      refetchHistory();
    } catch (err: any) {
      const message = err.response?.data?.error || '업로드 중 오류가 발생했습니다.';
      setStatus({ type: 'error', message });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="page-container">
      <Card shadow="sm" padding="xl" radius="md" withBorder maw={860} mx="auto">
        <Group mb="lg" gap="sm">
          <ThemeIcon size={40} radius="md" color="blue" variant="light">
            <span style={{ fontSize: 22 }}>📂</span>
          </ThemeIcon>
          <div>
            <Text size="xl" fw={700}>직원 명부 업로드</Text>
            <Text size="sm" c="dimmed">직원 명부 엑셀 파일을 업로드합니다</Text>
          </div>
        </Group>

        {/* 드래그 앤 드롭 영역 */}
        <Card
          padding="xl"
          radius="md"
          withBorder
          mb="lg"
          style={{
            borderStyle: 'dashed',
            borderColor: dragging ? 'var(--mantine-color-blue-5)' : 'var(--mantine-color-gray-4)',
            backgroundColor: dragging ? 'var(--mantine-color-blue-0)' : 'var(--mantine-color-gray-0)',
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
        >
          <Stack align="center" gap="xs">
            <span style={{ fontSize: 40 }}>📥</span>
            <Text fw={600} size="md">클릭하거나 파일을 드래그하세요</Text>
            <Text size="sm" c="dimmed">.xlsx 형식만 지원 (최대 10MB)</Text>
          </Stack>
        </Card>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        <Button
          fullWidth
          size="md"
          loading={uploading}
          onClick={() => fileInputRef.current?.click()}
          mb="lg"
        >
          파일 선택하여 업로드
        </Button>

        {status && (
          <Alert
            color={status.type === 'success' ? 'green' : 'red'}
            title={status.type === 'success' ? '✅ 업로드 성공' : '❌ 업로드 실패'}
            mb="lg"
          >
            {status.message}
          </Alert>
        )}

        <Card padding="md" radius="md" bg="gray.0" withBorder>
          <Text size="sm" fw={600} mb="xs" c="dimmed">업로드 파일 필수 컬럼</Text>
          <List size="sm" c="dimmed" spacing={4}>
            <List.Item>이름</List.Item>
            <List.Item>주민등록번호</List.Item>
            <List.Item>상태 (재직중 / 휴직중)</List.Item>
            <List.Item>고용형태 (정규직 / 수습 등)</List.Item>
          </List>
        </Card>
      </Card>

      {history.length > 0 && (
        <Card shadow="sm" padding="xl" radius="md" withBorder maw={860} mx="auto" mt="lg">
          <Group mb="md" gap="sm">
            <ThemeIcon size={36} radius="md" color="gray" variant="light">
              <span style={{ fontSize: 18 }}>📋</span>
            </ThemeIcon>
            <Text size="lg" fw={700}>업로드 내역</Text>
          </Group>
          <Table striped highlightOnHover withTableBorder withColumnBorders fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>업로드 일시</Table.Th>
                <Table.Th>업로드한 사람</Table.Th>
                <Table.Th>파일명</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>인원 수</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {history.map((entry, i) => (
                <Table.Tr key={i}>
                  <Table.Td c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                    {new Date(entry.timestamp).toLocaleString('ko-KR', {
                      year: 'numeric', month: '2-digit', day: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </Table.Td>
                  <Table.Td fw={500}>{entry.uploaderName}</Table.Td>
                  <Table.Td c="dimmed" style={{ fontSize: '0.8rem' }}>{entry.fileName}</Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Badge color="blue" variant="light">{entry.count.toLocaleString()}명</Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
