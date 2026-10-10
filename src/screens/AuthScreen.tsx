import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { loginAccount, registerAccount, sealAccountProfile, verifyMfa } from '../auth/api';
import AuthCredentialsForm from '../components/auth/AuthCredentialsForm';
import AuthMfaForm from '../components/auth/AuthMfaForm';
import {
  base64ToBytes,
  bytesToBase64,
  createKdfSalt,
  deriveDataKey,
  emailLookup,
  encryptUtf8,
  normalizeEmail,
} from '../crypto/e2e';

type Mode = 'login' | 'register';

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

export default function AuthScreen() {
  const { closeAuth, signIn } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordAgain, setPasswordAgain] = useState('');
  const [code, setCode] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);
  const profileTask = useRef<Promise<void> | null>(null);
  const dataKeyRef = useRef<Uint8Array | null>(null);

  const sealProfile = (
    mfaTokenValue: string,
    profileEmail: string,
    profileName: string,
    keyPromise: Promise<Uint8Array>,
    salt: Uint8Array,
  ) => {
    const task = keyPromise.then(async (dataKey) => {
      dataKeyRef.current = dataKey;
      await sealAccountProfile({
        mfaToken: mfaTokenValue,
        kdfSalt: bytesToBase64(salt),
        email: encryptUtf8(profileEmail, dataKey),
        displayName: encryptUtf8(profileName, dataKey),
      });
    });
    profileTask.current = task;
    void task.catch((sealError: unknown) => {
      setError(sealError instanceof Error ? sealError.message : 'Nie udało się zaszyfrować profilu.');
    });
  };

  const submitCredentials = async () => {
    if (!isEmail(email)) {
      setError('Podaj prawidłowy adres e-mail.');
      return;
    }
    if (password.length < 10 || password.length > 128) {
      setError('Hasło musi mieć od 10 do 128 znaków.');
      return;
    }
    if (mode === 'register') {
      if (displayName.trim().length < 2 || displayName.trim().length > 80) {
        setError('Nazwa musi mieć od 2 do 80 znaków.');
        return;
      }
      if (password !== passwordAgain) {
        setError('Hasła nie są takie same.');
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      if (mode === 'register') {
        const salt = createKdfSalt();
        const keyPromise = deriveDataKey(password, salt);
        try {
          const challenge = await registerAccount({
            emailLookup: emailLookup(email),
            password,
          });
          setMfaToken(challenge.mfaToken);
          setTotpSecret(challenge.totpSecret ?? null);
          sealProfile(challenge.mfaToken, normalizeEmail(email), displayName.trim(), keyPromise, salt);
        } catch (registerError) {
          void keyPromise.then(() => undefined);
          throw registerError;
        }
      } else {
        const challenge = await loginAccount(emailLookup(email), password);
        setMfaToken(challenge.mfaToken);
        setTotpSecret(challenge.totpSecret ?? null);
        if (!challenge.profileReady) {
          const salt = createKdfSalt();
          sealProfile(
            challenge.mfaToken,
            normalizeEmail(email),
            displayName.trim() || 'Użytkownik',
            deriveDataKey(password, salt),
            salt,
          );
        }
      }
      setCode('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Nie udało się zalogować.');
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async () => {
    if (!mfaToken) return;
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Wpisz 6-cyfrowy kod z aplikacji uwierzytelniającej.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (profileTask.current) {
        try {
          await profileTask.current;
        } catch {
          const salt = createKdfSalt();
          const keyPromise = deriveDataKey(password, salt);
          sealProfile(mfaToken, normalizeEmail(email), displayName.trim() || 'Użytkownik', keyPromise, salt);
          await profileTask.current;
        }
      }
      const payload = await verifyMfa(mfaToken, code.trim());
      const dataKey = dataKeyRef.current ?? await deriveDataKey(password, base64ToBytes(payload.kdfSalt));
      await signIn(payload, dataKey);
      dataKeyRef.current = null;
      profileTask.current = null;
      setPassword('');
      setPasswordAgain('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Nie udało się potwierdzić kodu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={closeAuth} style={styles.backButton}>
          <Text style={styles.backText}>← Wróć</Text>
        </Pressable>
        <Text style={styles.title}>{mfaToken ? 'Weryfikacja dwuetapowa' : mode === 'login' ? 'Logowanie' : 'Rejestracja'}</Text>
        <Text style={styles.subtitle}>
          Dane profilu i obserwacje są szyfrowane na telefonie algorytmem AES-256-GCM. Serwer nie dostaje klucza.
        </Text>

        {mfaToken ? (
          <AuthMfaForm
            totpSecret={totpSecret}
            code={code}
            secretCopied={secretCopied}
            loading={loading}
            onCodeChange={setCode}
            onCopied={() => setSecretCopied(true)}
            onSubmit={() => void submitCode()}
            onBack={() => {
              setMfaToken(null);
              setTotpSecret(null);
              setSecretCopied(false);
              setCode('');
              setError(null);
              dataKeyRef.current = null;
              profileTask.current = null;
            }}
          />
        ) : (
          <AuthCredentialsForm
            mode={mode}
            email={email}
            displayName={displayName}
            password={password}
            passwordAgain={passwordAgain}
            loading={loading}
            onModeChange={setMode}
            onEmailChange={setEmail}
            onDisplayNameChange={setDisplayName}
            onPasswordChange={setPassword}
            onPasswordAgainChange={setPasswordAgain}
            onSubmit={() => void submitCredentials()}
          />
        )}
        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#081a14' },
  content: { padding: 20, paddingTop: 28, paddingBottom: 40 },
  backButton: { alignSelf: 'flex-start', marginBottom: 16 },
  backText: { color: '#b9e7c2', fontWeight: '700' },
  title: { color: '#edf9f1', fontSize: 30, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#cfe3d8', fontSize: 14, lineHeight: 21, marginBottom: 18 },
  error: { color: '#ffc1b5', marginTop: 14, lineHeight: 20 },
});
