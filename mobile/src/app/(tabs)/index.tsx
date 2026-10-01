import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { accountBalances, budgetsForMonth, listRecurring, listTransactions, monthTotals } from '@/db/repo';
import { useQuery } from '@/db/store';
import { budgetLevel, budgetRatio } from '@/lib/budget';
import { daysBetween, monthOf, relativeDays, today } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { nextOccurrence } from '@/lib/recurrence';
import { useSync } from '@/sync/SyncProvider';
import { Bubble, Button, Card, Divider, Empty, Fab, IconButton, Ionicons, Money, Pill, ProgressBar, Row, Screen, Section, T } from '@/ui/components';
import { radius, space, useColors } from '@/ui/theme';
import { TransactionRow } from '@/ui/widgets';

export default function HomeScreen() {
  const c = useColors();
  const { session, status, syncNow } = useSync();
  const now = today();
  const month = monthOf(now);

  const { data } = useQuery(
    async (db) => {
      const [accounts, totals, budgets, bills, recent] = await Promise.all([
        accountBalances(db),
        monthTotals(db, month),
        budgetsForMonth(db, month),
        listRecurring(db),
        listTransactions(db, { limit: 6 }),
      ]);
      return { accounts, totals, budgets, bills, recent };
    },
    [month],
  );

  const balance = data?.accounts.reduce((s, a) => s + a.balance, 0) ?? 0;
  const watch = (data?.budgets ?? [])
    .map((b) => ({ ...b, ratio: budgetRatio(b.spent, b.amount), level: budgetLevel(b.spent, b.amount) }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 3);
  const upcoming = (data?.bills ?? [])
    .filter((b) => b.active)
    .map((b) => ({ ...b, due: nextOccurrence(b.startDate, b.frequency, now) }))
    .filter((b) => daysBetween(now, b.due) <= 14)
    .sort((a, b) => (a.due < b.due ? -1 : 1))
    .slice(0, 4);

  return (
    <View style={{ flex: 1 }}>
      <Screen
        title={session ? `Hi, ${session.name.split(' ')[0]}` : 'Kira'}
        right={<IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />}
        refreshing={status === 'syncing'}
        onRefresh={session ? () => void syncNow() : undefined}>
        <View style={[styles.hero, { backgroundColor: c.hero }]}>
          <T style={{ color: c.heroMuted, fontWeight: '600' }}>Total balance</T>
          <T variant="big" style={{ color: c.heroText, marginTop: 4 }}>
            {formatMoney(balance)}
          </T>
          <T variant="small" style={{ color: c.heroMuted, marginTop: space.lg, marginBottom: space.sm }}>
            This month
          </T>
          <Row style={{ gap: space.md }}>
            <HeroStat icon="arrow-down" label="Income" value={data?.totals.income ?? 0} />
            <HeroStat icon="arrow-up" label="Spending" value={data?.totals.expense ?? 0} />
          </Row>
        </View>

        {!session ? (
          <Pressable onPress={() => router.push('/sign-in')} style={[styles.syncHint, { backgroundColor: c.primarySoft }]}>
            <Ionicons name="cloud-upload-outline" size={20} color={c.primary} />
            <T variant="small" style={{ flex: 1, color: c.text }}>
              Your data is saved on this phone. Sign in to back it up and sync across devices.
            </T>
            <Ionicons name="chevron-forward" size={18} color={c.primary} />
          </Pressable>
        ) : null}

        <Section title="Budget watch" action={<Link label="All budgets" to="/budgets" />}>
          {watch.length === 0 ? (
            <Card>
              <T variant="muted">Set a monthly limit for a category and Kira warns you at 80% and when you go over.</T>
              <Button label="Add a budget" icon="add" variant="secondary" onPress={() => router.push('/budget')} style={{ marginTop: space.md }} />
            </Card>
          ) : (
            <Card style={{ gap: space.lg }}>
              {watch.map((b) => (
                <View key={b.id}>
                  <Row style={{ justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                    <Row style={{ gap: 8, flex: 1 }}>
                      <T>{b.icon}</T>
                      <T numberOfLines={1} style={{ fontWeight: '600', flexShrink: 1 }}>
                        {b.name}
                      </T>
                    </Row>
                    {b.level !== 'ok' ? <Pill text={b.level === 'over' ? 'Over budget' : `${Math.floor(b.ratio * 100)}% used`} tone={b.level} /> : null}
                  </Row>
                  <ProgressBar ratio={b.ratio} level={b.level} />
                  <T variant="small" style={{ marginTop: 6 }}>
                    {formatMoney(b.spent)} of {formatMoney(b.amount)}
                  </T>
                </View>
              ))}
            </Card>
          )}
        </Section>

        <Section title="Upcoming bills" action={<Link label="All bills" to="/bills" />}>
          {upcoming.length === 0 ? (
            <Card>
              <T variant="muted">Nothing due in the next two weeks.</T>
            </Card>
          ) : (
            <Card style={{ paddingVertical: space.xs }}>
              {upcoming.map((b, i) => (
                <View key={b.id}>
                  {i > 0 ? <Divider /> : null}
                  <Row style={{ paddingVertical: space.md }}>
                    <Bubble emoji={b.categoryIcon} color={b.categoryColor} />
                    <View style={{ flex: 1, marginLeft: space.md }}>
                      <T style={{ fontWeight: '600' }}>{b.name}</T>
                      <T variant="small">Due {relativeDays(b.due, now)}</T>
                    </View>
                    <Money sen={b.amount} sign={false} />
                  </Row>
                </View>
              ))}
            </Card>
          )}
        </Section>

        <Section title="Recent" action={<Link label="See all" to="/activity" />}>
          {data && data.recent.length === 0 ? (
            <Card>
              <Empty icon="receipt-outline" title="No transactions yet" body="Tap + to add your first expense or income." />
            </Card>
          ) : (
            <Card style={{ paddingVertical: space.xs }}>
              {(data?.recent ?? []).map((tx, i) => (
                <View key={tx.id}>
                  {i > 0 ? <Divider /> : null}
                  <TransactionRow tx={tx} />
                </View>
              ))}
            </Card>
          )}
        </Section>
      </Screen>
      <Fab onPress={() => router.push('/transaction')} />
    </View>
  );
}

function HeroStat({ icon, label, value }: { icon: 'arrow-down' | 'arrow-up'; label: string; value: number }) {
  const c = useColors();
  return (
    <View style={[styles.heroStat, { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
      <Row style={{ gap: 6 }}>
        <Ionicons name={icon} size={14} color={c.heroMuted} />
        <T variant="small" style={{ color: c.heroMuted }}>
          {label}
        </T>
      </Row>
      <T style={{ color: c.heroText, fontWeight: '700', fontSize: 17, marginTop: 4 }}>{formatMoney(value)}</T>
    </View>
  );
}

function Link({ label, to }: { label: string; to: '/budgets' | '/bills' | '/activity' }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="link" onPress={() => router.navigate(to)} hitSlop={8}>
      <T variant="small" style={{ color: c.primary, fontWeight: '600' }}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.lg, padding: space.xl, marginTop: space.sm },
  heroStat: { flex: 1, borderRadius: radius.md, padding: space.md },
  syncHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.lg,
  },
});
