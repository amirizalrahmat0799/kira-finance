import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { categorySpent, getRecurring, getTransaction, listAccounts, listCategories, save, softDelete } from '@/db/repo';
import { useQuery } from '@/db/store';
import type { Kind } from '@/db/types';
import { monthOf, today, type ISODate } from '@/lib/dates';
import { parseAmount, toInput } from '@/lib/money';
import { checkBudgetAlert } from '@/services/automation';
import { Button, Card, Field, Ionicons, Row, Screen, Segmented, T } from '@/ui/components';
import { AccountPicker, CategoryPicker, DateField, Label } from '@/ui/pickers';
import { radius, space, useColors } from '@/ui/theme';
import { showToast } from '@/ui/widgets';

export default function TransactionScreen() {
  const c = useColors();
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [kind, setKind] = useState<Kind>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [date, setDate] = useState<ISODate>(today());
  const [note, setNote] = useState('');
  const [recurringId, setRecurringId] = useState<string | null>(null);
  const [billName, setBillName] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!id);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data } = useQuery(
    async (d) => ({ categories: await listCategories(d, kind), accounts: await listAccounts(d) }),
    [kind],
  );

  // Editing: load the transaction once
  useEffect(() => {
    if (!id) return;
    (async () => {
      const tx = await getTransaction(db, id);
      if (!tx) {
        router.back();
        return;
      }
      setKind(tx.kind);
      setAmount(toInput(tx.amount));
      setCategoryId(tx.categoryId);
      setAccountId(tx.accountId);
      setDate(tx.occurredOn);
      setNote(tx.note);
      setRecurringId(tx.recurringId);
      if (tx.recurringId) setBillName((await getRecurring(db, tx.recurringId))?.name ?? null);
      setLoaded(true);
    })();
  }, [db, id]);

  // Sensible defaults: first account, and drop a category that doesn't match the kind
  // Sensible defaults without extra renders: first account, and ignore a category that doesn't match the kind
  const selectedAccount = accountId ?? data?.accounts[0]?.id ?? null;
  const selectedCategory = categoryId && data?.categories.some((x) => x.id === categoryId) ? categoryId : null;

  const onSave = async () => {
    const sen = parseAmount(amount);
    const categoryId = selectedCategory;
    const accountId = selectedAccount;
    if (!sen) return setError('Enter an amount, like 12.50');
    if (!categoryId) return setError('Pick a category');
    if (!accountId) return setError('Pick an account');
    setError(null);
    setSaving(true);
    try {
      const category = data?.categories.find((x) => x.id === categoryId);
      const before = kind === 'expense' ? await categorySpent(db, categoryId, monthOf(date)) : 0;
      // When editing, the old amount is already in "before"; subtract it so crossing is measured fairly.
      const old = id ? await getTransaction(db, id) : null;
      const baseline = old && old.kind === 'expense' && old.categoryId === categoryId && monthOf(old.occurredOn) === monthOf(date) ? before - old.amount : before;

      await save(db, 'transactions', { id, kind, amount: sen, categoryId, accountId, occurredOn: date, note: note.trim(), recurringId });

      if (kind === 'expense' && category) {
        const alert = await checkBudgetAlert(db, categoryId, category.name, date, baseline);
        if (alert) showToast({ title: alert.title, body: alert.body, tone: alert.level });
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    const doDelete = async () => {
      if (id) await softDelete(db, 'transactions', id);
      router.back();
    };
    if (Platform.OS === 'web') return void doDelete();
    Alert.alert('Delete transaction?', 'This removes it from all your devices.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void doDelete() },
    ]);
  };

  if (!loaded) return null;
  const accent = kind === 'income' ? c.income : c.expense;

  return (
    <Screen>
      <Stack.Screen options={{ title: id ? 'Edit transaction' : 'New transaction' }} />
      <View style={{ marginTop: space.lg }}>
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: 'Expense' },
            { value: 'income', label: 'Income' },
          ]}
        />
      </View>

      <Card style={{ marginTop: space.lg, alignItems: 'center', paddingVertical: space.xl }}>
        <T variant="label">Amount</T>
        <Row style={{ marginTop: space.sm }}>
          <Text style={{ color: accent, fontSize: 28, fontWeight: '700', marginRight: 6 }}>RM</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={c.faint}
            keyboardType="decimal-pad"
            inputMode="decimal"
            autoFocus={!id}
            accessibilityLabel="Amount in ringgit"
            style={[styles.amount, { color: accent }]}
          />
        </Row>
      </Card>

      {recurringId ? (
        <Row style={[styles.notice, { backgroundColor: c.primarySoft }]}>
          <Ionicons name="repeat" size={16} color={c.primary} />
          <T variant="small" style={{ color: c.text, flex: 1 }}>
            Recorded automatically by the recurring bill{billName ? ` “${billName}”` : ''}.
          </T>
        </Row>
      ) : null}

      <Label>Category</Label>
      <CategoryPicker categories={data?.categories ?? []} value={selectedCategory} onChange={setCategoryId} kind={kind} />

      <Label>Account</Label>
      <AccountPicker accounts={data?.accounts ?? []} value={selectedAccount} onChange={setAccountId} />

      <Label>Date</Label>
      <DateField value={date} onChange={setDate} />

      <Field label="Note" value={note} onChangeText={setNote} placeholder="e.g. Nasi lemak with team" maxLength={120} />

      {error ? <Text style={{ color: c.danger, marginTop: space.lg, fontWeight: '600' }}>{error}</Text> : null}

      <Button label={id ? 'Save changes' : 'Add transaction'} onPress={onSave} loading={saving} style={{ marginTop: space.xl }} />
      {id ? <Button label="Delete" variant="danger" icon="trash-outline" onPress={onDelete} style={{ marginTop: space.md }} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  amount: { fontSize: 40, fontWeight: '800', minWidth: 140, textAlign: 'center', paddingVertical: 4, ...(Platform.OS === 'web' ? { outlineWidth: 0 } : null) },
  notice: { gap: space.sm, padding: space.md, borderRadius: radius.md, marginTop: space.md },
});
