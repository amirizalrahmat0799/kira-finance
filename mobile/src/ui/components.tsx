import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { BudgetLevel } from '@/lib/budget';
import { formatMoney } from '@/lib/money';

import { radius, space, useColors } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ---------------------------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------------------------

export function Screen({
  title,
  right,
  children,
  scroll = true,
  refreshing,
  onRefresh,
  padded = true,
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
}) {
  const c = useColors();
  const header = title ? (
    <View style={styles.header}>
      <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
        {title}
      </Text>
      {right}
    </View>
  ) : null;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[padded && styles.padded, { paddingBottom: 120 }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.primary} /> : undefined}>
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padded && styles.padded]}>
          {header}
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }, style]}>{children}</View>;
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ marginTop: space.xl }}>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>;
}

export function Divider() {
  const c = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: 64 }} />;
}

// ---------------------------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------------------------

type TextVariant = 'body' | 'muted' | 'small' | 'label' | 'h2' | 'big';

export function T({
  children,
  variant = 'body',
  style,
  numberOfLines,
}: {
  children: ReactNode;
  variant?: TextVariant;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const c = useColors();
  const color = variant === 'muted' || variant === 'small' || variant === 'label' ? c.muted : c.text;
  return (
    <Text numberOfLines={numberOfLines} style={[textStyles[variant], { color }, style]}>
      {children}
    </Text>
  );
}

export function Money({
  sen,
  kind,
  style,
  sign = true,
}: {
  sen: number;
  kind?: 'income' | 'expense';
  style?: StyleProp<TextStyle>;
  sign?: boolean;
}) {
  const c = useColors();
  const color = kind === 'income' ? c.income : kind === 'expense' ? c.text : c.text;
  const prefix = sign && kind === 'income' ? '+' : sign && kind === 'expense' ? '−' : '';
  return (
    <Text style={[textStyles.money, { color }, style]} numberOfLines={1}>
      {prefix}
      {formatMoney(sen)}
    </Text>
  );
}

// ---------------------------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------------------------

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const bg = { primary: c.primary, secondary: c.cardAlt, danger: c.dangerSoft, ghost: 'transparent' }[variant];
  const fg = { primary: c.primaryText, secondary: c.text, danger: c.danger, ghost: c.primary }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label }: { icon: IconName; onPress: () => void; label: string }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={20} color={c.text} />
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  leading,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  leading?: string;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? c.primarySoft : c.card,
          borderColor: selected ? c.primary : c.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      {leading ? <Text style={{ fontSize: 15 }}>{leading}</Text> : null}
      <Text style={{ color: selected ? c.primary : c.text, fontWeight: selected ? '600' : '500', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  const c = useColors();
  return (
    <View style={[styles.segmented, { backgroundColor: c.cardAlt }]} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={{ color: active ? c.text : c.muted, fontWeight: '600' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({
  label,
  hint,
  error,
  style,
  ...input
}: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  const c = useColors();
  return (
    <View style={{ marginTop: space.lg }}>
      <Text style={[textStyles.label, { color: c.muted, marginBottom: 6 }]}>{label}</Text>
      <TextInput
        placeholderTextColor={c.faint}
        {...input}
        style={[
          styles.input,
          { backgroundColor: c.card, borderColor: error ? c.danger : c.border, color: c.text },
          style,
        ]}
      />
      {error ? (
        <Text style={{ color: c.danger, marginTop: 4, fontSize: 13 }}>{error}</Text>
      ) : hint ? (
        <Text style={{ color: c.faint, marginTop: 4, fontSize: 13 }}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Fab({ onPress, label = 'Add transaction' }: { onPress: () => void; label?: string }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.fab, { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 }]}>
      <Ionicons name="add" size={30} color={c.primaryText} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------------------------
// Data display
// ---------------------------------------------------------------------------------------------

export function Bubble({ emoji, color, size = 40 }: { emoji: string; color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color + '26',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ fontSize: size * 0.48 }}>{emoji}</Text>
    </View>
  );
}

export function ProgressBar({ ratio, level }: { ratio: number; level: BudgetLevel }) {
  const c = useColors();
  const color = level === 'over' ? c.danger : level === 'warning' ? c.warn : c.primary;
  return (
    <View
      style={[styles.track, { backgroundColor: c.track }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.min(ratio, 1) * 100) }}>
      <View style={{ width: `${Math.min(ratio, 1) * 100}%`, backgroundColor: color, height: '100%', borderRadius: radius.pill }} />
    </View>
  );
}

export function Empty({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: c.primarySoft }]}>
        <Ionicons name={icon} size={28} color={c.primary} />
      </View>
      <T variant="h2" style={{ textAlign: 'center' }}>
        {title}
      </T>
      {body ? (
        <T variant="muted" style={{ textAlign: 'center', marginTop: 6, maxWidth: 300 }}>
          {body}
        </T>
      ) : null}
      {action ? <View style={{ marginTop: space.lg }}>{action}</View> : null}
    </View>
  );
}

export function Pill({ text, tone }: { text: string; tone: 'ok' | 'warning' | 'over' | 'neutral' }) {
  const c = useColors();
  const map = {
    ok: [c.primarySoft, c.primary],
    warning: [c.warnSoft, c.warn],
    over: [c.dangerSoft, c.danger],
    neutral: [c.cardAlt, c.muted],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill }}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

export { Ionicons };

const textStyles = StyleSheet.create({
  body: { fontSize: 16 },
  muted: { fontSize: 15 },
  small: { fontSize: 13 },
  label: { fontSize: 13, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
  h2: { fontSize: 18, fontWeight: '700' },
  big: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  money: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
});

const styles = StyleSheet.create({
  padded: { paddingHorizontal: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.md, paddingBottom: space.sm },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.lg },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  segmented: { flexDirection: 'row', borderRadius: radius.md, padding: 4 },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  fab: {
    position: 'absolute',
    right: space.xl,
    bottom: space.xl,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  empty: { alignItems: 'center', paddingVertical: space.xxl, paddingHorizontal: space.lg },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
});
