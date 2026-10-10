import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Mode = 'login' | 'register';

type Props = {
  mode: Mode;
  email: string;
  displayName: string;
  password: string;
  passwordAgain: string;
  loading: boolean;
  onModeChange: (mode: Mode) => void;
  onEmailChange: (value: string) => void;
  onDisplayNameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onPasswordAgainChange: (value: string) => void;
  onSubmit: () => void;
};

export default function AuthCredentialsForm({
  mode,
  email,
  displayName,
  password,
  passwordAgain,
  loading,
  onModeChange,
  onEmailChange,
  onDisplayNameChange,
  onPasswordChange,
  onPasswordAgainChange,
  onSubmit,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.switchRow}>
        <Pressable style={[styles.switchButton, mode === 'login' && styles.switchButtonActive]} onPress={() => onModeChange('login')}>
          <Text style={[styles.switchText, mode === 'login' && styles.switchTextActive]}>Logowanie</Text>
        </Pressable>
        <Pressable style={[styles.switchButton, mode === 'register' && styles.switchButtonActive]} onPress={() => onModeChange('register')}>
          <Text style={[styles.switchText, mode === 'register' && styles.switchTextActive]}>Rejestracja</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>E-mail</Text>
      <TextInput
        value={email}
        onChangeText={onEmailChange}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="jan@example.com"
        placeholderTextColor="#6f9482"
        style={styles.input}
        textContentType="emailAddress"
      />

      {mode === 'register' && (
        <>
          <Text style={styles.label}>Nazwa</Text>
          <TextInput
            value={displayName}
            onChangeText={onDisplayNameChange}
            placeholder="Twoja nazwa"
            placeholderTextColor="#6f9482"
            style={styles.input}
          />
        </>
      )}

      <Text style={styles.label}>Hasło</Text>
      <TextInput
        value={password}
        onChangeText={onPasswordChange}
        secureTextEntry
        placeholder="Minimum 10 znaków"
        placeholderTextColor="#6f9482"
        style={styles.input}
        textContentType={mode === 'register' ? 'newPassword' : 'password'}
      />

      {mode === 'register' && (
        <>
          <Text style={styles.label}>Powtórz hasło</Text>
          <TextInput
            value={passwordAgain}
            onChangeText={onPasswordAgainChange}
            secureTextEntry
            placeholder="Powtórz hasło"
            placeholderTextColor="#6f9482"
            style={styles.input}
            textContentType="newPassword"
          />
          <Text style={styles.help}>
            Hasła nie da się odzyskać. Bez niego zaszyfrowane obserwacje i profil pozostaną nieczytelne.
          </Text>
        </>
      )}

      <Pressable style={[styles.primaryButton, loading && styles.disabled]} onPress={onSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#f5fff7" /> : <Text style={styles.primaryText}>{mode === 'login' ? 'Dalej' : 'Utwórz konto'}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0f251d',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1d3d34',
    padding: 16,
  },
  switchRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  switchButton: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', backgroundColor: '#102a21' },
  switchButtonActive: { backgroundColor: '#1c4337' },
  switchText: { color: '#9ec0ae', fontWeight: '700' },
  switchTextActive: { color: '#edf9f1' },
  label: { color: '#9ec0ae', fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 10, textTransform: 'uppercase' },
  input: {
    backgroundColor: '#102a21',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1b3e34',
    color: '#edf9f1',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  help: { color: '#cfe3d8', fontSize: 13, lineHeight: 19, marginTop: 10 },
  primaryButton: { backgroundColor: '#2d8d62', borderRadius: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  primaryText: { color: '#f5fff7', fontWeight: '800', fontSize: 16 },
  disabled: { opacity: 0.6 },
});
