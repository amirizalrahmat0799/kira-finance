import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { budgetsForMonth } from '@/db/repo';
import { useQuery } from '@/db/store';
import { budgetLevel, budgetRatio, dailyAllowance } from '@/lib/budget';
import { daysBetween, monthOf, monthRange, today } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { Bubble, Button, Card, Empty, Pill, ProgressBar, Row, Screen, T } from '@/ui/components';
import { space, useColors } from '@/ui/theme';
import { MonthSwitcher } from '@/ui/widgets';

export default function BudgetsScreen() {
  const c = useColors();
  const now = today();
  const current = monthOf(now);
  const [month, setMonth] = useState(current);
  const { data: budgets } = useQuery((db) => budgetsForMonth(db, month), [month]);

  const limit = (budgets ?? []).reduce((s, b) => s + b.amount, 0);
  const spent = (budgets ?? []).reduce((s, b) => s + Math.min(b.spent, Number.MAX_SAFE_INTEGER), 0);
  const level = budgetLevel(spent, limit);
  const daysLeft = month === current ? daysBetween(now, monthRange(month).end) + 1 : 0;

  return (
    <Screen
      title="Budgets"
      right={<Button label="Add" icon="add" variant="secondary" onPress={() => router.push('/budget')} style={{ minHeight: 40 }} />}>
      <MonthSwitcher month={month} onChange={setMonth} max={current} />

      {budgets && budgets.length === 0 ? (
        <Empty
          icon="pie-chart-outline"
          title="No budgets yet"
          body="Pick a category and a monthly limit. Kira warns you at 80% and again when you go over."
          action={<Button label="Create a budget" icon="add" onPress={() => router.push('/budget')} />}
        />
      ) : null}

      {budgets && budgets.length > 0 ? (
        <>
          <Card style={{ marginTop: space.lg }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T variant="label">Spent of total budget</T>
              <Pill text={`${Math.round(budgetRatio(spent, limit) * 100)}%`} tone={level} />
            </Row>
            <T style={{ fontSize: 26, fontWeight: '800', marginTop: 6 }}>
              {formatMoney(spent)}
              <T variant="muted" style={{ fontSize: 16, fontWeight: '500' }}>
                {'  '}of {formatMoney(limit)}
              </T>
            </T>
            <View style={{ marginTop: space.md }}>
              <ProgressBar ratio={budgetRatio(spent, limit)} level={level} />
            </View>
            {daysLeft > 0 ? (
              <T variant="small" style={{ marginTop: space.md }}>
                {limit - spent >= 0
                  ? `${formatMoney(limit - spent)} left · about ${formatMoney(dailyAllowance(spent, limit, daysLeft))} a day for ${daysLeft} more days`
                  : `${formatMoney(spent - limit)} over budget this month`}
              </T>
            ) : null}
          </Card>

          <View style={{ marginTop: space.lg, gap: space.md }}>
            {budgets.map((b) => {
              const ratio = budgetRatio(b.spent, b.amount);
              const lvl = budgetLevel(b.spent, b.amount);
              const left = b.amount - b.spent;
              return (
                <Pressable
                  key={b.id}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/budget', params: { id: b.id } })}>
                  <Card>
                    <Row style={{ gap: space.md }}>
                      <Bubble emoji={b.icon} color={b.color} />
                      <View style={{ flex: 1 }}>
                        <Row style={{ justifyContent: 'space-between' }}>
                          <T style={{ fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>
                            {b.name}
                          </T>
                          {lvl !== 'ok' ? <Pill text={lvl === 'over' ? 'Over budget' : 'Almost there'} tone={lvl} /> : null}
                        </Row>
                        <T variant="small">
                          {formatMoney(b.spent)} of {formatMoney(b.amount)}
                        </T>
                      </View>
                    </Row>
                    <View style={{ marginTop: space.md }}>
                      <ProgressBar ratio={ratio} level={lvl} />
                    </View>
                    <T variant="small" style={{ marginTop: 8, color: left < 0 ? c.danger : c.muted }}>
                      {left >= 0 ? `${formatMoney(left)} left` : `${formatMoney(-left)} over`}
                    </T>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
