import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

type Props = {
  totpSecret: string | null;
  code: string;
  secretCopied: boolean;
  loading: boolean;
  onCodeChange: (value: string) => void;
  onCopied: () => void;
  onSubmit: () => void;
  onBack: () => void;
};

function formatSecret(secret: string): string {
  return secret.replace(/(.{4})/g, '$1 ').trim();
}

export default function AuthMfaForm({ totpSecret, code, secretCopied, loading, onCodeChange, onCopied, onSubmit, onBack }: Props) {
  return (
    <View style={styles.card}>
      {totpSecret ? (
        <>
          <Text style={styles.label}>Dodaj konto w aplikacji uwierzytelniającej</Text>
          <Text style={styles.help}>
            W Google Authenticator lub Aegis wybierz ręczne dodanie konta. Wpisz sekret, algorytm SHA1, 6 cyfr i okres 30 sekund.
          </Text>
          <Text selectable style={styles.secret}>{formatSecret(totpSecret)}</Text>
          <Pressable
            style={styles.copyButton}
            onPress={() => {
              void Clipboard.setStringAsync(totpSecret).then(() => onCopied());
            }}
          >
            <Text style={styles.copyButtonText}>{secretCopied ? 'Skopiowano' : 'Kopiuj kod'}</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.help}>Wpisz kod z aplikacji uwierzytelniającej powiązanej z tym kontem.</Text>
      )}
      <Text style={styles.label}>Kod</Text>
      <TextInput
        value={code}
        onChangeText={onCodeChange}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="000000"
        placeholderTextColor="#6f9482"
        style={styles.input}
        textContentType="oneTimeCode"
      />
      <Pressable style={[styles.primaryButton, loading && styles.disabled]} onPress={onSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#f5fff7" /> : <Text style={styles.primaryText}>Potwierdź kod</Text>}
      </Pressable>
      <Pressable onPress={onBack} style={styles.secondaryButton}>
        <Text style={styles.secondaryText}>Wróć do hasła</Text>
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
  secret: {
    color: '#dffced',
    backgroundColor: '#102a21',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  copyButton: {
    marginTop: 10,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#42735a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyButtonText: { color: '#dffced', fontWeight: '800' },
  primaryButton: { backgroundColor: '#2d8d62', borderRadius: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  primaryText: { color: '#f5fff7', fontWeight: '800', fontSize: 16 },
  secondaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  secondaryText: { color: '#b9e7c2', fontWeight: '700' },
  disabled: { opacity: 0.6 },
});
