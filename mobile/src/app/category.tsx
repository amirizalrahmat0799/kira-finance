import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { save } from '@/db/repo';
import type { Kind } from '@/db/types';
import { Bubble, Button, Field, Screen, Segmented } from '@/ui/components';
import { Label } from '@/ui/pickers';
import { radius, space, useColors } from '@/ui/theme';

const EMOJIS = ['🍜', '☕', '🛒', '🚗', '⛽', '🏠', '💡', '📱', '🛍️', '👕', '💊', '🏋️', '🎬', '🎮', '✈️', '🎓', '🐱', '👶', '🎁', '💼', '💻', '📈', '🏦', '📦'];
const COLORS = ['#F97316', '#EAB308', '#84CC16', '#22C55E', '#14B8A6', '#0EA5E9', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E', '#64748B'];

export default function CategoryScreen() {
  const c = useColors();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ kind?: Kind }>();
  const [kind, setKind] = useState<Kind>(params.kind === 'income' ? 'income' : 'expense');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(EMOJIS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  const onSave = async () => {
    if (!name.trim()) return setError('Give the category a name');
    await save(db, 'categories', { name: name.trim(), kind, icon, color });
    router.back();
  };

  return (
    <Screen>
      <View style={{ alignItems: 'center', marginTop: space.lg }}>
        <Bubble emoji={icon} color={color} size={64} />
      </View>
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
      <Field label="Name" value={name} onChangeText={setName} placeholder="Coffee, Pets…" maxLength={30} />
      <Label>Icon</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {EMOJIS.map((e) => (
          <Pressable
            key={e}
            accessibilityLabel={`Icon ${e}`}
            onPress={() => setIcon(e)}
            style={{
              width: 46,
              height: 46,
              borderRadius: radius.sm,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: e === icon ? c.primary : 'transparent',
              backgroundColor: c.card,
            }}>
            <Text style={{ fontSize: 22 }}>{e}</Text>
          </Pressable>
        ))}
      </View>
      <Label>Colour</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {COLORS.map((col) => (
          <Pressable
            key={col}
            accessibilityLabel={`Colour ${col}`}
            onPress={() => setColor(col)}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: col, borderWidth: 3, borderColor: col === color ? c.text : 'transparent' }}
          />
        ))}
      </View>
      {error ? <Text style={{ color: c.danger, marginTop: space.lg, fontWeight: '600' }}>{error}</Text> : null}
      <Button label="Create category" onPress={onSave} style={{ marginTop: space.xl }} />
    </Screen>
  );
}
