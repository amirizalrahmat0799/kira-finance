import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { monthlySeries, spendingByCategory } from '@/db/repo';
import { useQuery } from '@/db/store';
import { addMonths, daysBetween, monthOf, monthRange, today } from '@/lib/dates';
import { categoryBreakdown, savingsRate } from '@/lib/insights';
import { formatMoney } from '@/lib/money';
import { Bubble, Card, Empty, Row, Screen, Section, T } from '@/ui/components';
import { space, useColors } from '@/ui/theme';
import { Donut, IncomeExpenseBars, Legend, MonthSwitcher } from '@/ui/widgets';

export default function InsightsScreen() {
  const c = useColors();
  const { width } = useWindowDimensions();
  const now = today();
  const current = monthOf(now);
  const [month, setMonth] = useState(current);

  const { data } = useQuery(
    async (db) => {
      const [spend, prevSpend, series] = await Promise.all([
        spendingByCategory(db, month),
        spendingByCategory(db, addMonths(month, -1)),
        monthlySeries(db, month, 6),
      ]);
      return { spend, prevSpend, series };
    },
    [month],
  );

  const rows = categoryBreakdown(data?.spend ?? [], data?.prevSpend ?? []);
  const totalSpent = rows.reduce((s, r) => s + r.total, 0);
  const thisMonth = data?.series[data.series.length - 1];
  const rate = thisMonth ? savingsRate(thisMonth.income, thisMonth.expense) : null;
  const days = month === current ? daysBetween(monthRange(month).start, now) + 1 : Number(monthRange(month).end.slice(8));
  const chartWidth = Math.min(width, 700) - space.lg * 2 - space.lg * 2;

  return (
    <Screen title="Insights">
      <MonthSwitcher month={month} onChange={setMonth} max={current} />

      <Row style={{ gap: space.sm, marginTop: space.lg }}>
        <Card style={{ flex: 1, padding: space.md }}>
          <T variant="small">Savings rate</T>
          <T style={{ fontWeight: '800', fontSize: 20, marginTop: 2, color: rate !== null && rate < 0 ? c.expense : c.text }}>
            {rate === null ? '–' : `${Math.round(rate * 100)}%`}
          </T>
        </Card>
        <Card style={{ flex: 1, padding: space.md }}>
          <T variant="small">Average per day</T>
          <T style={{ fontWeight: '800', fontSize: 20, marginTop: 2 }}>{formatMoney(Math.round(totalSpent / Math.max(1, days)))}</T>
        </Card>
      </Row>

      <Section title="Where your money went">
        <Card>
          {rows.length === 0 ? (
            <Empty icon="pie-chart-outline" title="No spending yet" body="Expenses you add this month show up here by category." />
          ) : (
            <>
              <View style={{ alignItems: 'center', marginVertical: space.sm }}>
                <Donut
                  slices={rows.map((r) => ({ value: r.total, color: r.color }))}
                  centerLabel="Spent"
                  centerValue={formatMoney(totalSpent)}
                />
              </View>
              <View style={{ marginTop: space.lg, gap: space.md }}>
                {rows.map((r) => (
                  <Row key={r.categoryId} style={{ gap: space.md }}>
                    <Bubble emoji={r.icon} color={r.color} size={34} />
                    <View style={{ flex: 1 }}>
                      <T numberOfLines={1} style={{ fontWeight: '600' }}>
                        {r.name}
                      </T>
                      <T variant="small">{Math.round(r.share * 100)}% of spending</T>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <T style={{ fontWeight: '700' }}>{formatMoney(r.total)}</T>
                      <T variant="small" style={{ color: r.change === null ? c.faint : r.change > 0.005 ? c.expense : r.change < -0.005 ? c.income : c.muted }}>
                        {r.change === null ? 'new' : `${r.change > 0.005 ? '▲' : r.change < -0.005 ? '▼' : '='} ${Math.abs(Math.round(r.change * 100))}% vs last month`}
                      </T>
                    </View>
                  </Row>
                ))}
              </View>
            </>
          )}
        </Card>
      </Section>

      <Section title="Last 6 months">
        <Card>
          <IncomeExpenseBars points={data?.series ?? []} width={chartWidth} highlight={month} />
          <Legend
            items={[
              { label: 'Income', color: c.income },
              { label: 'Expenses', color: c.expense },
            ]}
          />
        </Card>
      </Section>
    </Screen>
  );
}
