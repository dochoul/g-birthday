import { useQuery } from '@tanstack/react-query';
import { Card, Text, Group, Loader, Center, SimpleGrid, ThemeIcon, Box, Table, Badge } from '@mantine/core';
import { BarChart } from '@mantine/charts';
import '@mantine/charts/styles.css';
import { getBirthdayStats, getEmployeeSummary } from '../api/client';

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <Card padding="lg" radius="md" withBorder style={{ borderLeft: `4px solid var(--mantine-color-${color}-5)` }}>
      <Group justify="space-between" align="center">
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>{label}</Text>
          <Text size="2rem" fw={800} lh={1}>{value}<Text span size="sm" fw={400} c="dimmed" ml={4}>명</Text></Text>
        </div>
        <ThemeIcon size={44} radius="md" color={color} variant="light">
          <span style={{ fontSize: 22 }}>{icon}</span>
        </ThemeIcon>
      </Group>
    </Card>
  );
}

export default function StatsPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['birthdayStats'],
    queryFn: getBirthdayStats,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['employeeSummary'],
    queryFn: getEmployeeSummary,
  });

  const chartData = stats?.map((s) => ({
    month: `${s.month}월`,
    정규직: s.정규직,
    '정규직-수습': s.정규직수습,
    인턴: s.인턴,
    휴직중: s.휴직중,
  })) ?? [];

  const total = stats?.reduce((sum, s) => sum + s.정규직 + s.정규직수습 + s.인턴 + s.휴직중, 0) ?? 0;
  const totalHujik = stats?.reduce((sum, s) => sum + s.휴직중, 0) ?? 0;
  const total정규직 = stats?.reduce((sum, s) => sum + s.정규직, 0) ?? 0;
  const total정규직수습 = stats?.reduce((sum, s) => sum + s.정규직수습, 0) ?? 0;
  const total인턴 = stats?.reduce((sum, s) => sum + s.인턴, 0) ?? 0;

  const maxEntry = stats?.reduce((max, s) => {
    const total = s.정규직 + s.정규직수습 + s.인턴 + s.휴직중;
    const maxTotal = max.정규직 + max.정규직수습 + max.인턴 + max.휴직중;
    return total > maxTotal ? s : max;
  }, { month: 0, 정규직: 0, 정규직수습: 0, 인턴: 0, 휴직중: 0 });

  return (
    <div className="page-container">
      <SimpleGrid cols={5} mb="lg">
        <StatCard label="전체 생일자" value={total} color="blue" icon="🎂" />
        <StatCard label="정규직" value={total정규직} color="teal" icon="💼" />
        <StatCard label="정규직-수습" value={total정규직수습} color="orange" icon="📋" />
        <StatCard label="인턴" value={total인턴} color="violet" icon="🎓" />
        <StatCard label="휴직중" value={totalHujik} color="gray" icon="🌙" />
      </SimpleGrid>

      <SimpleGrid cols={3} mb="lg">
        {[
          { key: '정규직수습명단' as const, label: '정규직-수습', icon: '📋', color: 'orange' },
          { key: '인턴명단' as const, label: '인턴', icon: '🎓', color: 'violet' },
          { key: '휴직명단' as const, label: '휴직중', icon: '🌙', color: 'gray' },
        ].map(({ key, label, icon, color }) => (
          <Card key={key} shadow="sm" padding="lg" radius="md" withBorder>
            <Group mb="md">
              <ThemeIcon size={32} radius="md" color={color} variant="light">
                <span style={{ fontSize: 18 }}>{icon}</span>
              </ThemeIcon>
              <div>
                <Text fw={700} size="md">{label}</Text>
                <Text size="xs" c="dimmed">{summary?.[key]?.length ?? 0}명</Text>
              </div>
            </Group>
            {summaryLoading ? (
              <Center py="md"><Loader size="sm" /></Center>
            ) : !summary?.[key]?.length ? (
              <Text c="dimmed" size="sm" ta="center" py="md">해당 직원이 없습니다</Text>
            ) : (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>이름</Table.Th>
                    <Table.Th>생일</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {summary[key].map((emp, idx) => {
                    const [, mm, dd] = emp.birthday.split('-');
                    return (
                      <Table.Tr key={idx}>
                        <Table.Td>
                          <Group gap="xs">
                            {emp.name}
                            <Badge size="xs" color={color} variant="light">{label}</Badge>
                          </Group>
                        </Table.Td>
                        <Table.Td>{parseInt(mm)}월 {parseInt(dd)}일</Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            )}
          </Card>
        ))}
      </SimpleGrid>

      <Card shadow="sm" padding="xl" radius="md" withBorder>
        <Group justify="space-between" align="center" mb="xl">
          <div>
            <Text fw={700} size="lg">🎂 월별 생일자 현황</Text>
            {maxEntry && (maxEntry.정규직 + maxEntry.정규직수습 + maxEntry.인턴 + maxEntry.휴직중) > 0 && (
              <Text size="sm" c="dimmed">
                가장 많은 달: {maxEntry.month}월 ({maxEntry.정규직 + maxEntry.정규직수습 + maxEntry.인턴 + maxEntry.휴직중}명)
              </Text>
            )}
          </div>
          <Group gap="lg">
            {[
              { color: '#339af0', label: '정규직' },
              { color: '#f76707', label: '정규직-수습' },
              { color: '#7950f2', label: '인턴' },
              { color: '#adb5bd', label: '휴직중' },
            ].map(({ color, label }) => (
              <Group key={label} gap={6}>
                <Box w={12} h={12} style={{ borderRadius: 3, backgroundColor: color }} />
                <Text size="sm" c="dimmed">{label}</Text>
              </Group>
            ))}
          </Group>
        </Group>

        {isLoading ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : (
          <BarChart
            h={320}
            data={chartData}
            dataKey="month"
            type="stacked"
            series={[
              { name: '정규직', color: '#339af0' },
              { name: '정규직-수습', color: '#f76707' },
              { name: '인턴', color: '#7950f2' },
              { name: '휴직중', color: '#adb5bd' },
            ]}
            tickLine="none"
            gridAxis="y"
            withLegend={false}
            barProps={{ radius: 0 }}
            styles={{
              axis: { fontSize: 13 },
            }}
          />
        )}
      </Card>
    </div>
  );
}
