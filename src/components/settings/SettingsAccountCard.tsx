import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  loggedIn: boolean;
  displayName: string;
  email: string;
  syncLabel: string;
  onLogin: () => void;
  onLogout: () => void;
};

export default function SettingsAccountCard({ loggedIn, displayName, email, syncLabel, onLogin, onLogout }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>Konto</Text>
      {loggedIn ? (
        <>
          <Text style={styles.cardTitle}>{displayName}</Text>
          <Text style={styles.cardText}>{email}</Text>
          <Text style={styles.syncText}>Weryfikacja dwuetapowa jest włączona. {syncLabel}</Text>
          <Pressable style={styles.secondaryButton} onPress={onLogout}>
            <Text style={styles.secondaryButtonText}>Wyloguj</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.cardTitle}>Zaloguj się</Text>
          <Text style={styles.cardText}>
            Rejestracja chroni profil szyfrowaniem AES-256-GCM i pozwala kupić Premium. Obserwacje synchronizują się z telefonem, gdy jest internet.
          </Text>
          <Pressable style={styles.primaryButton} onPress={onLogin}>
            <Text style={styles.primaryButtonText}>Zaloguj się lub utwórz konto</Text>
          </Pressable>
        </>
      )}
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
  cardLabel: {
    color: '#9ec0ae',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  cardTitle: { color: '#f3faf4', fontSize: 24, fontWeight: '800' },
  cardText: { color: '#dfeae3', fontSize: 14, lineHeight: 22, marginBottom: 16 },
  syncText: { color: '#cfe3d8', fontSize: 13, lineHeight: 20, marginBottom: 14 },
  primaryButton: { backgroundColor: '#2d8d62', borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  primaryButtonText: { color: '#f5fff7', fontWeight: '800', fontSize: 15 },
  secondaryButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#42735a',
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: '#d4eadb', fontWeight: '800', fontSize: 15 },
});
