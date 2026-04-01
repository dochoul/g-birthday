import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Table, Badge, Select, Group, Text, Loader, Center, Button, Divider } from '@mantine/core';
import { getBirthdays, exportBirthdaysExcel } from '../api/client';

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1}월`,
}));

export default function BirthdayListPage() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const { data, isLoading } = useQuery({
    queryKey: ['birthdays', month],
    queryFn: () => getBirthdays(month),
  });

  const employees = data?.data ?? [];

  const handleExport = () => {
    const confirmed = window.confirm(
      `📋 ${month}월 생일자 엑셀 다운로드\n\n수습 중인 직원과 휴직 중인 직원은 제외되며,\n현재 재직 중인 생일자만 포함됩니다.\n\n다운로드 하시겠습니까?`
    );
    if (confirmed) exportBirthdaysExcel(month);
  };

  return (
    <div className="page-container">
      <Card shadow="sm" padding="xl" radius="md" withBorder>
        <Group justify="space-between" mb="lg">
          <Group gap="sm">
            <Text size="xl" fw={700}>
              🎂 {month}월 생일자
            </Text>
            <Badge size="xl" variant="filled" color="blue" fw={700} style={{ fontSize: 16 }}>
              {data?.count ?? 0}명
            </Badge>
          </Group>
          <Select
            data={MONTH_OPTIONS}
            value={String(month)}
            onChange={(val) => val && setMonth(Number(val))}
            w={100}
            allowDeselect={false}
          />
        </Group>

        {isLoading ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : employees.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            🎈 {month}월 생일자가 없습니다.
          </Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={60}>번호</Table.Th>
                <Table.Th>이름</Table.Th>
                <Table.Th w={100}>상태</Table.Th>
                <Table.Th w={120}>고용형태</Table.Th>
                <Table.Th w={100}>생일</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {employees.map((emp, idx) => {
                const isSuseup = emp.employmentType === '수습';
                const isHujik = emp.status === '휴직중';
                const isDisabled = isSuseup || isHujik;
                const icon = isHujik ? '🏠' : isSuseup ? '🌱' : '🎂';
                return (
                  <Table.Tr key={idx} style={isDisabled ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}>
                    <Table.Td>{idx + 1}</Table.Td>
                    <Table.Td fw={500}>{icon} {emp.name}</Table.Td>
                    <Table.Td>{emp.status}</Table.Td>
                    <Table.Td>{emp.employmentType}</Table.Td>
                    <Table.Td>
                      {emp.birthday ? emp.birthday.slice(5) : '-'}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}

        {!isLoading && employees.length > 0 && (
          <>
            <Divider my="lg" />
            <Group justify="flex-end">
              <Button
                variant="filled"
                color="green"
                size="md"
                leftSection={<span>📥</span>}
                onClick={handleExport}
              >
                {month}월 생일자 엑셀 다운로드
              </Button>
            </Group>
          </>
        )}
      </Card>
    </div>
  );
}
