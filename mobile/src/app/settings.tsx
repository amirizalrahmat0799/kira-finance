import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';

import { accountBalances, listCategories } from '@/db/repo';
import { addSampleData } from '@/db/sample';
import { useQuery } from '@/db/store';
import { ACCOUNT_TYPES } from '@/db/types';
import { formatMoney } from '@/lib/money';
import { refreshBillReminders } from '@/services/automation';
import { notificationsAllowed, notificationsSupported } from '@/services/notifications';
import { logout } from '@/sync/api';
import { pendingChanges, resetSyncState } from '@/sync/sync';
import { useSync } from '@/sync/SyncProvider';
import { Bubble, Button, Card, Divider, Ionicons, Money, Row, Screen, Section, T } from '@/ui/components';
import { space, useColors } from '@/ui/theme';

export default function SettingsScreen() {
  const c = useColors();
  const db = useSQLiteContext();
  const { session, status, lastSyncedAt, error, syncNow } = useSync();
  const [notifOn, setNotifOn] = useState<boolean | null>(null);

  const { data } = useQuery(
    async (d) => ({
      accounts: await accountBalances(d),
      categories: await listCategories(d),
      pending: await pendingChanges(d),
      notif: notificationsSupported ? await notificationsAllowed() : false,
    }),
    [],
  );
  const notificationsOn = notifOn ?? data?.notif ?? false;

  const confirm = (title: string, body: string, action: () => void) => {
    if (Platform.OS === 'web') return action();
    Alert.alert(title, body, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'OK', onPress: action },
    ]);
  };

  return (
    <Screen>
      <Section title="Sync">
        <Card>
          {session ? (
            <>
              <Row style={{ gap: space.md }}>
                <Ionicons
                  name={status === 'error' ? 'cloud-offline-outline' : 'cloud-done-outline'}
                  size={26}
                  color={status === 'error' ? c.danger : c.primary}
                />
                <View style={{ flex: 1 }}>
                  <T style={{ fontWeight: '700' }}>{session.email}</T>
                  <T variant="small">
                    {status === 'syncing'
                      ? 'Syncing…'
                      : error
                        ? error
                        : lastSyncedAt
                          ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}`
                          : 'Not synced yet'}
                  </T>
                  {data && data.pending > 0 ? <T variant="small">{data.pending} change(s) waiting to upload</T> : null}
                </View>
              </Row>
              <Row style={{ gap: space.sm, marginTop: space.lg }}>
                <Button label="Sync now" icon="sync" onPress={() => void syncNow()} loading={status === 'syncing'} style={{ flex: 1 }} />
                <Button
                  label="Sign out"
                  variant="secondary"
                  onPress={() =>
                    confirm('Sign out?', 'Your data stays on this phone. Changes made while signed out sync when you sign in again.', async () => {
                      await logout();
                      await resetSyncState(db, true);
                    })
                  }
                  style={{ flex: 1 }}
                />
              </Row>
            </>
          ) : (
            <>
              <T variant="muted">Your data is stored on this phone only. Create an account to back it up and use Kira on more than one device.</T>
              <Button label="Sign in or create account" icon="cloud-upload-outline" onPress={() => router.push('/sign-in')} style={{ marginTop: space.md }} />
            </>
          )}
        </Card>
      </Section>

      <Section
        title="Accounts"
        action={
          <Pressable onPress={() => router.push('/account')} hitSlop={8} accessibilityRole="button">
            <T variant="small" style={{ color: c.primary, fontWeight: '600' }}>
              Add account
            </T>
          </Pressable>
        }>
        <Card style={{ paddingVertical: space.xs }}>
          {(data?.accounts ?? []).map((a, i) => (
            <View key={a.id}>
              {i > 0 ? <Divider /> : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/account', params: { id: a.id } })}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.md }}>
                <Bubble emoji={ACCOUNT_TYPES.find((t) => t.value === a.type)?.icon ?? '💰'} color={c.primary} />
                <View style={{ flex: 1, marginLeft: space.md }}>
                  <T style={{ fontWeight: '600' }}>{a.name}</T>
                  <T variant="small">{ACCOUNT_TYPES.find((t) => t.value === a.type)?.label}</T>
                </View>
                <Money sen={a.balance} sign={false} style={{ color: a.balance < 0 ? c.expense : c.text }} />
              </Pressable>
            </View>
          ))}
        </Card>
      </Section>

      <Section title="Notifications">
        <Card>
          {notificationsSupported ? (
            <>
              <T variant="muted">Budget alerts at 80% and 100%, and reminders before bills are due.</T>
              {notificationsOn ? (
                <Row style={{ gap: 6, marginTop: space.md }}>
                  <Ionicons name="checkmark-circle" size={18} color={c.primary} />
                  <T style={{ fontWeight: '600' }}>Notifications are on</T>
                </Row>
              ) : (
                <Button
                  label="Turn on notifications"
                  icon="notifications-outline"
                  variant="secondary"
                  onPress={async () => {
                    const ok = await notificationsAllowed(true);
                    setNotifOn(ok);
                    if (ok) await refreshBillReminders(db);
                  }}
                  style={{ marginTop: space.md }}
                />
              )}
            </>
          ) : (
            <T variant="muted">Notifications are available in the Android and iOS app. Here, alerts show inside the app.</T>
          )}
        </Card>
      </Section>

      <Section title="Data">
        <Card>
          <T variant="muted">
            {data?.categories.length ?? 0} categories · {data?.accounts.length ?? 0} accounts · total {formatMoney((data?.accounts ?? []).reduce((s, a) => s + a.balance, 0))}
          </T>
          <Button
            label="Add sample data"
            icon="sparkles-outline"
            variant="secondary"
            onPress={() =>
              confirm('Add sample data?', 'Adds three months of example transactions, budgets and bills so you can try Kira out.', async () => {
                await addSampleData(db);
                router.back();
              })
            }
            style={{ marginTop: space.md }}
          />
        </Card>
        <T variant="small" style={{ textAlign: 'center', marginTop: space.xl }}>
          Kira 1.0 · offline-first personal finance
        </T>
      </Section>
    </Screen>
  );
}
