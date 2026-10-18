import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { postJson } from '../../api/http';
import { emailLookup, normalizeEmail } from '../../crypto/e2e';
import { colors } from '../../theme';

type TrustRequest = {
  id: string;
  userId: string;
  status: string;
  label: string;
  direction: 'outgoing' | 'incoming';
};

type Props = {
  isPremium: boolean;
  loggedIn: boolean;
  displayName: string;
  onLogin: () => void;
};

const statusLabel: Record<string, string> = {
  pending: 'oczekuje',
  accepted: 'zaakceptowane',
  declined: 'odrzucone',
};

export default function SettingsTrustedCard({ isPremium, loggedIn, displayName, onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [requests, setRequests] = useState<TrustRequest[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    const response = await postJson<{ requests: TrustRequest[] }>('/trusted/list', {}, true);
    setRequests(response.requests);
  }

  useEffect(() => {
    if (!loggedIn || !isPremium) {
      setRequests([]);
      return;
    }
    let mounted = true;
    postJson<{ requests: TrustRequest[] }>('/trusted/list', {}, true)
      .then((response) => {
        if (mounted) setRequests(response.requests);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [loggedIn, isPremium]);

  async function invite() {
    const normalized = normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setMessage('Podaj prawidłowy adres e-mail.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await postJson('/trusted/invite', { emailLookup: emailLookup(normalized), email: normalized, label: displayName }, true);
      setEmail('');
      setMessage('Prośba wysłana. Trasa będzie widoczna po akceptacji.');
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nie udało się wysłać prośby.');
    } finally {
      setBusy(false);
    }
  }

  async function respond(request: TrustRequest, accept: boolean) {
    setBusy(true);
    setMessage(null);
    try {
      await postJson('/trusted/respond', { id: request.id, accept }, true);
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nie udało się zapisać odpowiedzi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Premium</Text>
      <Text style={styles.title}>Zaufani użytkownicy</Text>
      <Text style={styles.text}>Dodaj osobę po adresie e-mail. Gdy zaakceptuje prośbę, podczas wyprawy widzicie się na mapie na bieżąco.</Text>
      {loggedIn && !isPremium ? (
        <Text style={styles.text}>Dodawanie zaufanych jest w planie Premium. Przychodzące prośby możesz zaakceptować poniżej.</Text>
      ) : !loggedIn ? (
        <Pressable style={styles.button} onPress={onLogin}>
          <Text style={styles.buttonText}>Zaloguj się</Text>
        </Pressable>
      ) : (
        <View style={styles.row}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="e-mail"
            placeholderTextColor="#7f9c8d"
            style={styles.input}
          />
          <Pressable style={[styles.button, busy && styles.disabled]} disabled={busy} onPress={() => void invite()}>
            <Text style={styles.buttonText}>Dodaj</Text>
          </Pressable>
        </View>
      )}
      {isPremium && requests.map((request) => (
        <View key={request.id} style={styles.person}>
          <View style={styles.personText}>
            <Text style={styles.personName}>{request.label || 'Użytkownik'}</Text>
            <Text style={styles.personStatus}>{request.direction === 'incoming' ? 'prośba do Ciebie' : 'Twoja prośba'} · {statusLabel[request.status] ?? request.status}</Text>
          </View>
          {request.direction === 'incoming' && request.status === 'pending' ? (
            <View style={styles.row}>
              <Pressable style={styles.small} disabled={busy} onPress={() => void respond(request, true)}>
                <Text style={styles.buttonText}>Akceptuj</Text>
              </Pressable>
              <Pressable style={styles.smallMuted} disabled={busy} onPress={() => void respond(request, false)}>
                <Text style={styles.mutedText}>Odrzuć</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ))}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0f251d',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1d3d34',
    padding: 18,
    marginBottom: 16,
  },
  label: { color: '#9ec0ae', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 4, marginBottom: 8 },
  text: { color: '#c9ddd2', lineHeight: 20, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: '#0b1f1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  button: { backgroundColor: colors.button, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  buttonText: { color: colors.buttonText, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  person: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  personText: { marginBottom: 8 },
  personName: { color: colors.text, fontWeight: '800' },
  personStatus: { color: colors.muted, marginTop: 2 },
  small: { backgroundColor: colors.button, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  smallMuted: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
  mutedText: { color: colors.text, fontWeight: '700' },
  message: { color: colors.accent, marginTop: 12, lineHeight: 20 },
});
