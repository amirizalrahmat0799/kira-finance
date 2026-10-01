import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';

import { getRecurring, listAccounts, listCategories, save, softDelete } from '@/db/repo';
import { useQuery } from '@/db/store';
import type { Kind } from '@/db/types';
import { today, type ISODate } from '@/lib/dates';
import { parseAmount, toInput } from '@/lib/money';
import type { Frequency } from '@/lib/recurrence';
import { postDueRecurring, refreshBillReminders } from '@/services/automation';
import { notificationsAllowed, notificationsSupported } from '@/services/notifications';
import { Button, Card, Chip, Field, Row, Screen, Segmented, T } from '@/ui/components';
import { AccountPicker, CategoryPicker, DateField, Label } from '@/ui/pickers';
import { space, useColors } from '@/ui/theme';

const REMIND_OPTIONS = [0, 1, 2, 3, 7];

export default function BillScreen() {
  const c = useColors();
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [name, setName] = useState('');
  const [kind, setKind] = useState<Kind>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [startDate, setStartDate] = useState<ISODate>(today());
  const [remind, setRemind] = useState(2);
  const [active, setActive] = useState(true);
  const [loaded, setLoaded] = useState(!id);
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery(async (d) => ({ categories: await listCategories(d, kind), accounts: await listAccounts(d) }), [kind]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const r = await getRecurring(db, id);
      if (!r) return router.back();
      setName(r.name);
      setKind(r.kind);
      setAmount(toInput(r.amount));
      setCategoryId(r.categoryId);
      setAccountId(r.accountId);
      setFrequency(r.frequency);
      setStartDate(r.startDate);
      setRemind(r.remindDaysBefore);
      setActive(r.active);
      setLoaded(true);
    })();
  }, [db, id]);

  // Sensible defaults without extra renders: first account, and ignore a category that doesn't match the kind
  const selectedAccount = accountId ?? data?.accounts[0]?.id ?? null;
  const selectedCategory = categoryId && data?.categories.some((x) => x.id === categoryId) ? categoryId : null;

  const onSave = async () => {
    const sen = parseAmount(amount);
    const categoryId = selectedCategory;
    const accountId = selectedAccount;
    if (!name.trim()) return setError('Give it a name, like "Rent" or "Netflix"');
    if (!sen) return setError('Enter an amount');
    if (!categoryId) return setError('Pick a category');
    if (!accountId) return setError('Pick an account');
    await save(db, 'recurring', {
      id,
      name: name.trim(),
      kind,
      amount: sen,
      categoryId,
      accountId,
      frequency,
      startDate,
      remindDaysBefore: remind,
      active,
    });
    if (kind === 'expense' && active) await notificationsAllowed(true);
    await postDueRecurring(db);
    await refreshBillReminders(db);
    router.back();
  };

  if (!loaded) return null;

  return (
    <Screen>
      <Stack.Screen options={{ title: id ? 'Edit recurring' : 'New recurring' }} />
      <View style={{ marginTop: space.lg }}>
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: 'Bill' },
            { value: 'income', label: 'Income' },
          ]}
        />
      </View>

      <Field label="Name" value={name} onChangeText={setName} placeholder={kind === 'expense' ? 'Rent, Unifi, Netflix…' : 'Salary'} maxLength={60} />
      <Field label="Amount (RM)" value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" inputMode="decimal" />

      <Label>How often</Label>
      <Segmented
        value={frequency}
        onChange={setFrequency}
        options={[
          { value: 'weekly', label: 'Weekly' },
          { value: 'monthly', label: 'Monthly' },
          { value: 'yearly', label: 'Yearly' },
        ]}
      />

      <Label>{id ? 'First due date' : 'Next due date'}</Label>
      <DateField value={startDate} onChange={setStartDate} allowFuture />
      <T variant="small" style={{ marginTop: 6 }}>
        Kira records it automatically on each due date. Monthly bills on the 29th–31st move to the last day of shorter months.
      </T>

      {kind === 'expense' ? (
        <>
          <Label>Remind me</Label>
          <Row style={{ flexWrap: 'wrap', gap: space.sm }}>
            {REMIND_OPTIONS.map((d) => (
              <Chip key={d} label={d === 0 ? 'On the day' : `${d} day${d > 1 ? 's' : ''} before`} selected={remind === d} onPress={() => setRemind(d)} />
            ))}
          </Row>
          {!notificationsSupported ? (
            <T variant="small" style={{ marginTop: 6 }}>
              Reminders are sent on Android and iOS.
            </T>
          ) : null}
        </>
      ) : null}

      <Label>Category</Label>
      <CategoryPicker categories={data?.categories ?? []} value={selectedCategory} onChange={setCategoryId} kind={kind} />

      <Label>Paid from</Label>
      <AccountPicker accounts={data?.accounts ?? []} value={selectedAccount} onChange={setAccountId} />

      <Card style={{ marginTop: space.xl }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: '600' }}>Active</T>
            <T variant="small">Pause it to stop recording and reminders.</T>
          </View>
          <Switch value={active} onValueChange={setActive} trackColor={{ true: c.primary }} accessibilityLabel="Active" />
        </Row>
      </Card>

      {error ? <Text style={{ color: c.danger, marginTop: space.lg, fontWeight: '600' }}>{error}</Text> : null}
      <Button label="Save" onPress={onSave} style={{ marginTop: space.xl }} />
      {id ? (
        <Button
          label="Delete"
          variant="danger"
          icon="trash-outline"
          onPress={async () => {
            await softDelete(db, 'recurring', id);
            await refreshBillReminders(db);
            router.back();
          }}
          style={{ marginTop: space.md }}
        />
      ) : null}
    </Screen>
  );
}
