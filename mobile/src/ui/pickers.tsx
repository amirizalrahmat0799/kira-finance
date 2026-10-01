import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Account, Category } from '@/db/types';
import { ACCOUNT_TYPES } from '@/db/types';
import { addDays, dayLabel, isValidISODate, today, type ISODate } from '@/lib/dates';

import { Chip, Ionicons, T } from './components';
import { radius, space, useColors } from './theme';

export function Label({ children }: { children: string }) {
  return (
    <T variant="label" style={{ marginTop: space.xl, marginBottom: space.sm }}>
      {children}
    </T>
  );
}

/** Grid of category tiles, with a tile to create a new category. */
export function CategoryPicker({
  categories,
  value,
  onChange,
  kind,
}: {
  categories: Category[];
  value: string | null;
  onChange: (id: string) => void;
  kind: 'expense' | 'income';
}) {
  const c = useColors();
  return (
    <View style={styles.grid}>
      {categories.map((cat) => {
        const selected = cat.id === value;
        return (
          <Pressable
            key={cat.id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={cat.name}
            onPress={() => onChange(cat.id)}
            style={[
              styles.tile,
              {
                backgroundColor: selected ? cat.color + '22' : c.card,
                borderColor: selected ? cat.color : c.border,
              },
            ]}>
            <Text style={{ fontSize: 22 }}>{cat.icon}</Text>
            <Text numberOfLines={1} style={{ color: c.text, fontSize: 12, fontWeight: selected ? '700' : '500', marginTop: 4 }}>
              {cat.name}
            </Text>
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="New category"
        onPress={() => router.push({ pathname: '/category', params: { kind } })}
        style={[styles.tile, { backgroundColor: c.card, borderColor: c.border, borderStyle: 'dashed' }]}>
        <Ionicons name="add" size={22} color={c.muted} />
        <Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>New</Text>
      </Pressable>
    </View>
  );
}

export function AccountPicker({ accounts, value, onChange }: { accounts: Account[]; value: string | null; onChange: (id: string) => void }) {
  return (
    <View style={styles.wrap}>
      {accounts.map((a) => (
        <Chip
          key={a.id}
          label={a.name}
          leading={ACCOUNT_TYPES.find((t) => t.value === a.type)?.icon}
          selected={a.id === value}
          onPress={() => onChange(a.id)}
        />
      ))}
    </View>
  );
}

/** Quick date choice (today / yesterday) plus a typed date, without a native date-picker dependency. */
export function DateField({ value, onChange, allowFuture = false }: { value: ISODate; onChange: (d: ISODate) => void; allowFuture?: boolean }) {
  const c = useColors();
  const now = today();
  const [text, setText] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const yesterday = addDays(now, -1);

  const set = (d: ISODate) => {
    setText(d);
    setError(null);
    onChange(d);
  };

  return (
    <View>
      <View style={styles.wrap}>
        <Chip label="Today" selected={value === now} onPress={() => set(now)} />
        <Chip label="Yesterday" selected={value === yesterday} onPress={() => set(yesterday)} />
        <Pressable accessibilityLabel="Previous day" onPress={() => set(addDays(value, -1))} style={[styles.step, { borderColor: c.border, backgroundColor: c.card }]}>
          <Ionicons name="chevron-back" size={18} color={c.text} />
        </Pressable>
        <Pressable
          accessibilityLabel="Next day"
          onPress={() => (allowFuture || addDays(value, 1) <= now ? set(addDays(value, 1)) : undefined)}
          style={[styles.step, { borderColor: c.border, backgroundColor: c.card }]}>
          <Ionicons name="chevron-forward" size={18} color={c.text} />
        </Pressable>
      </View>
      <View style={[styles.dateRow, { borderColor: error ? c.danger : c.border, backgroundColor: c.card }]}>
        <Ionicons name="calendar-outline" size={18} color={c.muted} />
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            if (isValidISODate(t) && (allowFuture || t <= now)) {
              setError(null);
              onChange(t);
            } else {
              setError(isValidISODate(t) ? 'That date is in the future' : 'Use YYYY-MM-DD');
            }
          }}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={c.faint}
          accessibilityLabel="Date"
          inputMode="numeric"
          style={{ flex: 1, color: c.text, fontSize: 16, paddingVertical: 10 }}
        />
        <T variant="small">{isValidISODate(value) ? dayLabel(value, now) : ''}</T>
      </View>
      {error ? <Text style={{ color: c.danger, marginTop: 4, fontSize: 13 }}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: {
    width: '23%',
    minWidth: 72,
    flexGrow: 1,
    maxWidth: '24%',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: 4,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  step: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    marginTop: space.sm,
  },
});
