import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { ApiError, login, register } from '@/sync/api';
import { prepareForAccount } from '@/sync/account';
import { DEFAULT_SERVER_URL } from '@/sync/session';
import { useSync } from '@/sync/SyncProvider';
import { Button, Card, Field, Ionicons, Row, Screen, Segmented, T } from '@/ui/components';
import { space, useColors } from '@/ui/theme';

type Mode = 'login' | 'register';

export default function SignInScreen() {
  const c = useColors();
  const db = useSQLiteContext();
  const { syncNow } = useSync();
  const [mode, setMode] = useState<Mode>('register');
  const [server, setServer] = useState(DEFAULT_SERVER_URL);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (mode === 'register' && !name.trim()) return setError('Enter your name');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email');
    if (password.length < 8) return setError('Password needs at least 8 characters');
    setBusy(true);
    try {
      if (mode === 'register') await register(server, name.trim(), email.trim(), password);
      else await login(server, email.trim(), password);
      await prepareForAccount(db, mode);
      await syncNow();
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card style={{ marginTop: space.lg, flexDirection: 'row', gap: space.md }}>
        <Ionicons name="shield-checkmark-outline" size={24} color={c.primary} />
        <T variant="small" style={{ flex: 1, color: c.text }}>
          Kira works fully offline. An account backs up your data to your own Kira server and keeps your devices in sync.
        </T>
      </Card>

      <View style={{ marginTop: space.lg }}>
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError(null);
          }}
          options={[
            { value: 'register', label: 'Create account' },
            { value: 'login', label: 'Sign in' },
          ]}
        />
      </View>

      {mode === 'register' ? <Field label="Name" value={name} onChangeText={setName} autoComplete="name" placeholder="Your name" /> : null}
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="you@example.com"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
        placeholder="At least 8 characters"
      />
      <Field
        label="Server"
        value={server}
        onChangeText={setServer}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        hint="On a phone, use your computer's address on the same Wi-Fi, e.g. http://192.168.1.20:8080"
      />

      {error ? (
        <Row style={{ marginTop: space.lg, gap: 6 }}>
          <Ionicons name="alert-circle" size={18} color={c.danger} />
          <Text style={{ color: c.danger, fontWeight: '600', flex: 1 }}>{error}</Text>
        </Row>
      ) : null}

      <Button label={mode === 'register' ? 'Create account' : 'Sign in'} onPress={submit} loading={busy} style={{ marginTop: space.xl }} />
    </Screen>
  );
}
