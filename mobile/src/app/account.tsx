import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { listAccounts, save } from '@/db/repo';
import { ACCOUNT_TYPES, type AccountType } from '@/db/types';
import { toInput } from '@/lib/money';
import { Button, Chip, Field, Screen } from '@/ui/components';
import { Label } from '@/ui/pickers';
import { space, useColors } from '@/ui/theme';

/** Opening balance may be zero or negative (a credit card), so it has its own parser. */
function parseBalance(s: string): number | null {
  const t = s.replace(/[,\s]/g, '');
  if (t === '') return 0;
  if (!/^-?\d+(\.\d{0,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

export default function AccountScreen() {
  const c = useColors();
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [opening, setOpening] = useState('');
  const [archived, setArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    listAccounts(db, true).then((all) => {
      const a = all.find((x) => x.id === id);
      if (!a) return;
      setName(a.name);
      setType(a.type);
      setOpening(toInput(a.openingBalance));
      setArchived(a.archived);
    });
  }, [db, id]);

  const onSave = async (archive = archived) => {
    const balance = parseBalance(opening);
    if (!name.trim()) return setError('Give the account a name');
    if (balance === null) return setError('Opening balance should look like 1500 or -250.50');
    await save(db, 'accounts', { id, name: name.trim(), type, openingBalance: balance, archived: archive });
    router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: id ? 'Edit account' : 'New account' }} />
      <Field label="Name" value={name} onChangeText={setName} placeholder="Maybank, Touch 'n Go…" maxLength={40} />
      <Label>Type</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {ACCOUNT_TYPES.map((t) => (
          <Chip key={t.value} label={t.label} leading={t.icon} selected={type === t.value} onPress={() => setType(t.value)} />
        ))}
      </View>
      <Field
        label="Opening balance (RM)"
        value={opening}
        onChangeText={setOpening}
        placeholder="0.00"
        keyboardType="numbers-and-punctuation"
        hint="What's in the account today, before any transactions you add in Kira. Negative for card debt."
      />
      {error ? <Text style={{ color: c.danger, marginTop: space.lg, fontWeight: '600' }}>{error}</Text> : null}
      <Button label="Save account" onPress={() => onSave()} style={{ marginTop: space.xl }} />
      {id ? (
        <Button
          label={archived ? 'Unarchive' : 'Archive account'}
          variant="secondary"
          icon="archive-outline"
          onPress={() => onSave(!archived)}
          style={{ marginTop: space.md }}
        />
      ) : null}
    </Screen>
  );
}
