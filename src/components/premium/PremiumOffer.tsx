import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { UsageStatus } from '../../billing';

type Props = {
  usage: UsageStatus | null;
  loggedIn: boolean;
  loading: boolean;
  error: string | null;
  onSubscribe: () => void;
  onManage: () => void;
  onLogin: () => void;
};

export default function PremiumOffer({ usage, loggedIn, loading, error, onSubscribe, onManage, onLogin }: Props) {
  return (
    <View style={styles.heroCard}>
      <Text style={styles.badge}>Najlepsza jakość</Text>
      <Text style={styles.price}>25 zł / miesiąc</Text>
      <Text style={styles.subtitle}>Jedno rozpoznanie AI dziennie, bez reklam.</Text>

      {usage?.plan === 'premium' && loggedIn ? (
        <>
          <View style={styles.activeBadge}>
            <Text style={styles.activeText}>Premium aktywne · {usage.dailyUsed}/1 rozpoznanie dzisiaj</Text>
          </View>
          <Pressable style={[styles.manageButton, loading && styles.disabledButton]} onPress={onManage} disabled={loading}>
            {loading ? <ActivityIndicator color="#edf8f1" /> : <Text style={styles.manageText}>Zarządzaj subskrypcją</Text>}
          </Pressable>
        </>
      ) : loggedIn ? (
        <Pressable style={[styles.ctaButton, loading && styles.disabledButton]} onPress={onSubscribe} disabled={loading}>
          {loading ? <ActivityIndicator color="#f5fff7" /> : <Text style={styles.ctaText}>Subskrybuj przez Stripe</Text>}
        </Pressable>
      ) : (
        <Pressable style={styles.ctaButton} onPress={onLogin}>
          <Text style={styles.ctaText}>
            {usage?.plan === 'premium' ? 'Zaloguj się, aby zarządzać subskrypcją' : 'Zaloguj się, aby kupić Premium'}
          </Text>
        </Pressable>
      )}
      {error && <Text style={styles.errorText}>{error}</Text>}
      <Text style={styles.paymentNote}>
        {loggedIn
          ? 'Płatność cykliczna. Subskrypcją zarządzasz w Stripe.'
          : 'Zakup subskrypcji Premium jest dostępny dopiero po zalogowaniu.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: '#102d24',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1e4338',
    padding: 18,
    marginBottom: 18,
  },
  badge: {
    backgroundColor: '#1c4337',
    color: '#dffced',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 12,
  },
  price: { color: '#f3faf4', fontSize: 32, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#dbeae2', fontSize: 14, lineHeight: 22, marginBottom: 18 },
  ctaButton: { backgroundColor: '#2d8d62', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  ctaText: { color: '#f5fff7', fontWeight: '800', fontSize: 16, textAlign: 'center', paddingHorizontal: 12 },
  activeBadge: { backgroundColor: '#17462f', borderRadius: 12, padding: 13 },
  activeText: { color: '#aff0b8', fontWeight: '800', textAlign: 'center' },
  manageButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderColor: '#42735a', borderWidth: 1, borderRadius: 12, marginTop: 10 },
  manageText: { color: '#d4eadb', fontWeight: '700', fontSize: 13 },
  disabledButton: { opacity: 0.6 },
  errorText: { color: '#ffc1b5', fontSize: 12, lineHeight: 18, marginTop: 12 },
  paymentNote: { color: '#8eaf9c', fontSize: 10, lineHeight: 15, marginTop: 10 },
});
