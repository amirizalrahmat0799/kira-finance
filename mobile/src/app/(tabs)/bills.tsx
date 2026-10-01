import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { listRecurring } from '@/db/repo';
import { useQuery } from '@/db/store';
import { dayLabel, daysBetween, relativeDays, today } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { FREQUENCY_LABEL, monthlyEquivalent, nextOccurrence } from '@/lib/recurrence';
import { Bubble, Button, Card, Empty, Ionicons, Money, Pill, Row, Screen, T } from '@/ui/components';
import { space, useColors } from '@/ui/theme';

export default function BillsScreen() {
  const c = useColors();
  const now = today();
  const { data: rules } = useQuery((db) => listRecurring(db), []);

  const items = (rules ?? [])
    .map((r) => ({ ...r, due: nextOccurrence(r.startDate, r.frequency, now) }))
    .sort((a, b) => Number(b.active) - Number(a.active) || (a.due < b.due ? -1 : 1));
  const monthlyOut = items
    .filter((r) => r.active && r.kind === 'expense')
    .reduce((s, r) => s + monthlyEquivalent(r.amount, r.frequency), 0);
  const monthlyIn = items
    .filter((r) => r.active && r.kind === 'income')
    .reduce((s, r) => s + monthlyEquivalent(r.amount, r.frequency), 0);

  return (
    <Screen
      title="Bills"
      right={<Button label="Add" icon="add" variant="secondary" onPress={() => router.push('/bill')} style={{ minHeight: 40 }} />}>
      {rules && rules.length === 0 ? (
        <Empty
          icon="calendar-outline"
          title="No recurring bills"
          body="Add rent, subscriptions or your salary. Kira records them on the due date and reminds you before bills are due."
          action={<Button label="Add a bill" icon="add" onPress={() => router.push('/bill')} />}
        />
      ) : null}

      {items.length > 0 ? (
        <Row style={{ gap: space.sm, marginTop: space.sm }}>
          <Card style={{ flex: 1, padding: space.md }}>
            <T variant="small">Bills per month</T>
            <T style={{ fontWeight: '800', fontSize: 18, marginTop: 2 }}>{formatMoney(monthlyOut)}</T>
          </Card>
          <Card style={{ flex: 1, padding: space.md }}>
            <T variant="small">Recurring income</T>
            <T style={{ fontWeight: '800', fontSize: 18, marginTop: 2, color: c.income }}>{formatMoney(monthlyIn)}</T>
          </Card>
        </Row>
      ) : null}

      <View style={{ marginTop: space.lg, gap: space.md }}>
        {items.map((r) => {
          const soon = r.active && daysBetween(now, r.due) <= 3;
          return (
            <Pressable key={r.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/bill', params: { id: r.id } })}>
              <Card style={{ opacity: r.active ? 1 : 0.55 }}>
                <Row style={{ gap: space.md }}>
                  <Bubble emoji={r.categoryIcon} color={r.categoryColor} />
                  <View style={{ flex: 1 }}>
                    <T style={{ fontWeight: '700' }} numberOfLines={1}>
                      {r.name}
                    </T>
                    <T variant="small">{FREQUENCY_LABEL[r.frequency]}</T>
                  </View>
                  <Money sen={r.amount} kind={r.kind === 'income' ? 'income' : undefined} sign={r.kind === 'income'} />
                </Row>
                <Row style={{ marginTop: space.md, justifyContent: 'space-between' }}>
                  <Row style={{ gap: 6 }}>
                    <Ionicons name="calendar-clear-outline" size={15} color={c.muted} />
                    <T variant="small">
                      {r.active ? `Next: ${dayLabel(r.due, now)}${Math.abs(daysBetween(now, r.due)) > 1 ? ` (${relativeDays(r.due, now)})` : ''}` : 'Paused'}
                    </T>
                  </Row>
                  {soon ? <Pill text="Due soon" tone="warning" /> : null}
                  {!soon && r.active && r.kind === 'expense' ? (
                    <Row style={{ gap: 4 }}>
                      <Ionicons name="notifications-outline" size={14} color={c.faint} />
                      <T variant="small" style={{ color: c.faint }}>
                        {r.remindDaysBefore === 0 ? 'on the day' : `${r.remindDaysBefore}d before`}
                      </T>
                    </Row>
                  ) : null}
                </Row>
              </Card>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
