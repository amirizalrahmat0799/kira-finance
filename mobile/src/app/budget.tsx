import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { listCategories, save, softDelete } from '@/db/repo';
import { useQuery } from '@/db/store';
import { fromRow, type SqlRow } from '@/db/tables';
import { parseAmount, toInput } from '@/lib/money';
import { Button, Field, Screen, T } from '@/ui/components';
import { CategoryPicker, Label } from '@/ui/pickers';
import { space, useColors } from '@/ui/theme';

export default function BudgetScreen() {
  const c = useColors();
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery(async (d) => {
    const categories = await listCategories(d, 'expense');
    const budgets = (await d.getAllAsync<SqlRow>('SELECT * FROM budgets WHERE deleted = 0')).map((r) => fromRow('budgets', r));
    return { categories, budgets };
  }, []);

  useEffect(() => {
    if (!id) return;
    db.getFirstAsync<SqlRow>('SELECT * FROM budgets WHERE id = $id', { $id: id }).then((row) => {
      if (!row) return;
      const b = fromRow('budgets', row);
      setCategoryId(b.categoryId);
      setAmount(toInput(b.amount));
    });
  }, [db, id]);

  // One budget per category: hide categories that already have one (except the one being edited)
  const taken = new Set((data?.budgets ?? []).filter((b) => b.id !== id).map((b) => b.categoryId));
  const available = (data?.categories ?? []).filter((x) => !taken.has(x.id));

  const onSave = async () => {
    const sen = parseAmount(amount);
    if (!categoryId) return setError('Pick a category');
    if (!sen) return setError('Enter a monthly limit, like 500');
    await save(db, 'budgets', { id, categoryId, amount: sen });
    router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: id ? 'Edit budget' : 'New budget' }} />
      <T variant="muted" style={{ marginTop: space.lg }}>
        A monthly spending limit for one category. It resets at the start of every month.
      </T>
      <Label>Category</Label>
      {available.length === 0 && data ? (
        <T variant="muted">Every expense category already has a budget.</T>
      ) : (
        <CategoryPicker categories={available} value={categoryId} onChange={setCategoryId} kind="expense" />
      )}
      <Field
        label="Monthly limit (RM)"
        value={amount}
        onChangeText={setAmount}
        placeholder="500"
        keyboardType="decimal-pad"
        inputMode="decimal"
      />
      {error ? <Text style={{ color: c.danger, marginTop: space.lg, fontWeight: '600' }}>{error}</Text> : null}
      <Button label="Save budget" onPress={onSave} style={{ marginTop: space.xl }} />
      {id ? (
        <Button
          label="Remove budget"
          variant="danger"
          icon="trash-outline"
          onPress={async () => {
            await softDelete(db, 'budgets', id);
            router.back();
          }}
          style={{ marginTop: space.md }}
        />
      ) : null}
    </Screen>
  );
}
