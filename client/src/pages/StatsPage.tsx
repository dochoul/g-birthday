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
    재직중: s.재직중,
    휴직중: s.휴직중,
  })) ?? [];

  const total = stats?.reduce((sum, s) => sum + s.재직중 + s.휴직중, 0) ?? 0;
  const totalHujik = stats?.reduce((sum, s) => sum + s.휴직중, 0) ?? 0;

  const maxEntry = stats?.reduce((max, s) => {
    return (s.재직중 + s.휴직중) > (max.재직중 + max.휴직중) ? s : max;
  }, { month: 0, 재직중: 0, 휴직중: 0 });

  return (
    <div className="page-container">
      <SimpleGrid cols={3} mb="lg">
        <StatCard label="전체 생일자" value={total} color="blue" icon="🎂" />
        <StatCard label="재직중" value={total - totalHujik} color="teal" icon="💼" />
        <StatCard label="휴직중" value={totalHujik} color="gray" icon="🌙" />
      </SimpleGrid>

      <SimpleGrid cols={1} mb="lg">
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group mb="md">
            <ThemeIcon size={32} radius="md" color="gray" variant="light">
              <span style={{ fontSize: 18 }}>🌙</span>
            </ThemeIcon>
            <div>
              <Text fw={700} size="md">휴직중 직원</Text>
              <Text size="xs" c="dimmed">{summary?.휴직명단?.length ?? 0}명</Text>
            </div>
          </Group>
          {summaryLoading ? (
            <Center py="md"><Loader size="sm" /></Center>
          ) : !summary?.휴직명단?.length ? (
            <Text c="dimmed" size="sm" ta="center" py="md">휴직중인 직원이 없습니다</Text>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>이름</Table.Th>
                  <Table.Th>생일</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {summary.휴직명단.map((emp, idx) => {
                  const [, mm, dd] = emp.birthday.split('-');
                  return (
                    <Table.Tr key={idx}>
                      <Table.Td>
                        <Group gap="xs">
                          {emp.name}
                          <Badge size="xs" color="gray" variant="light">휴직</Badge>
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
      </SimpleGrid>

      <Card shadow="sm" padding="xl" radius="md" withBorder>
        <Group justify="space-between" align="center" mb="xl">
          <div>
            <Text fw={700} size="lg">🎂 월별 생일자 현황</Text>
            {maxEntry && (maxEntry.재직중 + maxEntry.휴직중) > 0 && (
              <Text size="sm" c="dimmed">
                가장 많은 달: {maxEntry.month}월 ({maxEntry.재직중 + maxEntry.휴직중}명)
              </Text>
            )}
          </div>
          <Group gap="lg">
            {[
              { color: '#339af0', label: '재직중' },
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
              { name: '재직중', color: '#339af0' },
              { name: '휴직중', color: '#adb5bd' },
            ]}
            tickLine="none"
            gridAxis="y"
            withLegend={false}
            barProps={{ radius: [4, 4, 0, 0] }}
            styles={{
              axis: { fontSize: 13 },
            }}
          />
        )}
      </Card>
    </div>
  );
}
