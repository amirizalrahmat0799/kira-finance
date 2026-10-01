import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { listTransactions, monthTotals, type TransactionView } from '@/db/repo';
import { useQuery } from '@/db/store';
import type { Kind } from '@/db/types';
import { dayLabel, monthOf, today, type ISODate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { Card, Divider, Empty, Fab, Row, Screen, Segmented, T } from '@/ui/components';
import { space, useColors } from '@/ui/theme';
import { MonthSwitcher, TransactionRow } from '@/ui/widgets';

type Filter = 'all' | Kind;

export default function ActivityScreen() {
  const c = useColors();
  const current = monthOf(today());
  const [month, setMonth] = useState(current);
  const [filter, setFilter] = useState<Filter>('all');

  const { data } = useQuery(
    async (db) => {
      const [txs, totals] = await Promise.all([
        listTransactions(db, { month, kind: filter === 'all' ? undefined : filter }),
        monthTotals(db, month),
      ]);
      return { txs, totals };
    },
    [month, filter],
  );

  const groups = groupByDay(data?.txs ?? []);
  const net = (data?.totals.income ?? 0) - (data?.totals.expense ?? 0);

  return (
    <View style={{ flex: 1 }}>
      <Screen title="Activity">
        <MonthSwitcher month={month} onChange={setMonth} max={current} />
        <View style={{ marginTop: space.md }}>
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'expense', label: 'Expenses' },
              { value: 'income', label: 'Income' },
            ]}
          />
        </View>

        <Row style={{ marginTop: space.lg, gap: space.sm }}>
          <Stat label="In" value={formatMoney(data?.totals.income ?? 0)} color={c.income} />
          <Stat label="Out" value={formatMoney(data?.totals.expense ?? 0)} color={c.expense} />
          <Stat label="Net" value={formatMoney(net)} color={net >= 0 ? c.text : c.expense} />
        </Row>

        {data && groups.length === 0 ? (
          <Empty icon="receipt-outline" title="Nothing here" body="No transactions in this month yet." />
        ) : null}

        {groups.map(([day, txs]) => {
          const dayNet = txs.reduce((s, t) => s + (t.kind === 'income' ? t.amount : -t.amount), 0);
          return (
            <View key={day} style={{ marginTop: space.lg }}>
              <Row style={{ justifyContent: 'space-between', marginBottom: space.sm, paddingHorizontal: 4 }}>
                <T variant="label">{dayLabel(day)}</T>
                <T variant="small">{formatMoney(dayNet)}</T>
              </Row>
              <Card style={{ paddingVertical: space.xs }}>
                {txs.map((tx, i) => (
                  <View key={tx.id}>
                    {i > 0 ? <Divider /> : null}
                    <TransactionRow tx={tx} />
                  </View>
                ))}
              </Card>
            </View>
          );
        })}
      </Screen>
      <Fab onPress={() => router.push('/transaction')} />
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card style={{ flex: 1, padding: space.md }}>
      <T variant="small">{label}</T>
      <T numberOfLines={1} style={{ color, fontWeight: '700', marginTop: 2, fontSize: 14 }}>
        {value}
      </T>
    </Card>
  );
}

function groupByDay(txs: TransactionView[]): [ISODate, TransactionView[]][] {
  const map = new Map<ISODate, TransactionView[]>();
  for (const t of txs) {
    const list = map.get(t.occurredOn) ?? [];
    list.push(t);
    map.set(t.occurredOn, list);
  }
  return [...map.entries()];
}
