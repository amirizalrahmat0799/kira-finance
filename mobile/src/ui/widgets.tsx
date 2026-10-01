import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Rect, Text as SvgText } from 'react-native-svg';

import type { TransactionView } from '@/db/repo';
import { monthLabel, shortMonth, type Month } from '@/lib/dates';
import { formatCompact } from '@/lib/money';

import { Bubble, Ionicons, Money, T } from './components';
import { radius, space, useColors } from './theme';

export function TransactionRow({ tx }: { tx: TransactionView }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${tx.categoryName}, ${tx.note || tx.accountName}`}
      onPress={() => router.push({ pathname: '/transaction', params: { id: tx.id } })}
      style={({ pressed }) => [styles.txRow, { opacity: pressed ? 0.7 : 1 }]}>
      <Bubble emoji={tx.categoryIcon} color={tx.categoryColor} />
      <View style={{ flex: 1, marginLeft: space.md }}>
        <T numberOfLines={1} style={{ fontWeight: '600' }}>
          {tx.note || tx.categoryName}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <T variant="small" numberOfLines={1}>
            {tx.note ? `${tx.categoryName} · ${tx.accountName}` : tx.accountName}
          </T>
          {tx.recurringId ? <Ionicons name="repeat" size={13} color={c.faint} /> : null}
        </View>
      </View>
      <Money sen={tx.amount} kind={tx.kind} />
    </Pressable>
  );
}

export function MonthSwitcher({ month, onChange, max }: { month: Month; onChange: (m: Month) => void; max?: Month }) {
  const c = useColors();
  const step = (d: number) => {
    const [y, m] = month.split('-').map(Number);
    const total = y * 12 + (m - 1) + d;
    const next = `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
    if (!max || next <= max) onChange(next);
  };
  const atMax = !!max && month >= max;
  return (
    <View style={[styles.switcher, { backgroundColor: c.card, borderColor: c.border }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => step(-1)} hitSlop={10} style={styles.arrow}>
        <Ionicons name="chevron-back" size={20} color={c.text} />
      </Pressable>
      <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>{monthLabel(month)}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next month"
        onPress={() => step(1)}
        disabled={atMax}
        hitSlop={10}
        style={[styles.arrow, { opacity: atMax ? 0.3 : 1 }]}>
        <Ionicons name="chevron-forward" size={20} color={c.text} />
      </Pressable>
    </View>
  );
}

/** Donut chart of spending by category. */
export function Donut({
  slices,
  size = 200,
  centerLabel,
  centerValue,
}: {
  slices: { value: number; color: string }[];
  size?: number;
  centerLabel: string;
  centerValue: string;
}) {
  const c = useColors();
  const stroke = size * 0.14;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const total = slices.reduce((s, x) => s + x.value, 0);
  const gap = slices.length > 1 ? 2 : 0;

  let offset = 0;
  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel={`${centerLabel} ${centerValue}`}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.track} strokeWidth={stroke} fill="none" />
          {total > 0 &&
            slices.map((s, i) => {
              const len = (s.value / total) * circumference;
              const dash = Math.max(0, len - gap);
              const el = (
                <Circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke={s.color}
                  strokeWidth={stroke}
                  fill="none"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return el;
            })}
        </G>
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <T variant="small">{centerLabel}</T>
        <T style={{ fontSize: 20, fontWeight: '800' }}>{centerValue}</T>
      </View>
    </View>
  );
}

/** Grouped bars: income vs expense per month. */
export function IncomeExpenseBars({
  points,
  width,
  height = 180,
  highlight,
}: {
  points: { month: Month; income: number; expense: number }[];
  width: number;
  height?: number;
  highlight?: Month;
}) {
  const c = useColors();
  const top = 22;
  const bottom = 24;
  const chartH = height - top - bottom;
  const max = Math.max(1, ...points.flatMap((p) => [p.income, p.expense]));
  const slot = width / Math.max(1, points.length);
  const barW = Math.min(16, slot / 3.2);

  return (
    <Svg width={width} height={height} accessibilityLabel="Income and expenses by month">
      <SvgText x={0} y={12} fontSize={11} fill={c.faint}>
        {formatCompact(max)}
      </SvgText>
      <Rect x={0} y={top + chartH} width={width} height={1} fill={c.border} />
      {points.map((p, i) => {
        const cx = slot * i + slot / 2;
        const hi = (p.income / max) * chartH;
        const he = (p.expense / max) * chartH;
        const active = p.month === highlight;
        return (
          <G key={p.month} opacity={!highlight || active ? 1 : 0.55}>
            <Rect x={cx - barW - 1.5} y={top + chartH - hi} width={barW} height={Math.max(hi, 1)} rx={4} fill={c.income} />
            <Rect x={cx + 1.5} y={top + chartH - he} width={barW} height={Math.max(he, 1)} rx={4} fill={c.expense} />
            <SvgText
              x={cx}
              y={height - 6}
              fontSize={12}
              fontWeight={active ? '700' : '400'}
              fill={active ? c.text : c.muted}
              textAnchor="middle">
              {shortMonth(p.month)}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.lg, marginTop: space.sm }}>
      {items.map((i) => (
        <View key={i.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: i.color }} />
          <T variant="small">{i.label}</T>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Toasts: in-app alerts for budget warnings (they also go out as notifications on phones)
// ---------------------------------------------------------------------------------------------

type Toast = { id: number; title: string; body?: string; tone: 'warning' | 'over' | 'ok' };
let toasts: Toast[] = [];
let nextId = 1;
const toastListeners = new Set<(t: Toast[]) => void>();

export function showToast(t: Omit<Toast, 'id'>) {
  const toast = { ...t, id: nextId++ };
  toasts = [...toasts, toast];
  toastListeners.forEach((l) => l(toasts));
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== toast.id);
    toastListeners.forEach((l) => l(toasts));
  }, 4500);
}

export function ToastHost() {
  const c = useColors();
  const [items, setItems] = useState<Toast[]>(toasts);
  useEffect(() => {
    toastListeners.add(setItems);
    return () => {
      toastListeners.delete(setItems);
    };
  }, []);
  if (items.length === 0) return null;
  return (
    <View pointerEvents="none" style={styles.toastWrap}>
      {items.map((t) => {
        const accent = t.tone === 'over' ? c.danger : t.tone === 'warning' ? c.warn : c.primary;
        return (
          <View
            key={t.id}
            accessibilityLiveRegion="polite"
            style={[styles.toast, { backgroundColor: c.card, borderColor: c.border, borderLeftColor: accent }]}>
            <Text style={{ color: c.text, fontWeight: '700' }}>{t.title}</Text>
            {t.body ? <Text style={{ color: c.muted, marginTop: 2 }}>{t.body}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md },
  switcher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
  },
  arrow: { padding: 6 },
  toastWrap: { position: 'absolute', top: 56, left: space.lg, right: space.lg, gap: space.sm },
  toast: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 4,
    padding: space.md,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
