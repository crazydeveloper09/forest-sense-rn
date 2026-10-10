import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { UsageStatus } from '../../billing';

type Props = {
  usage: UsageStatus | null;
  loading: boolean;
  adLoading: boolean;
  adsEnabled: boolean;
  onWatchAd: () => void;
};

export default function RecognitionQuotaPanel({ usage, loading, adLoading, adsEnabled, onWatchAd }: Props) {
  return (
    <View style={styles.panel}>
      <Text style={styles.label}>{loading ? 'Sprawdzam limit…' : usage?.plan === 'premium' ? 'Limit Premium' : 'Limit darmowy'}</Text>
      <Text style={styles.value}>
        {loading || !usage ? '—' : usage.plan === 'premium' ? `${usage.dailyUsed}/1 dzisiaj` : `${usage.monthlyUsed}/10 w tym miesiącu${usage.rewardCredits ? ` · +${usage.rewardCredits} z reklam` : ''}`}
      </Text>
      {usage && !usage.canRecognize && usage.plan === 'free' && adsEnabled && (
        <Pressable style={styles.rewardButton} onPress={onWatchAd} disabled={adLoading}>
          {adLoading ? <ActivityIndicator color="#f5fff7" /> : <Text style={styles.rewardText}>Obejrzyj reklamę · +1 rozpoznanie</Text>}
        </Pressable>
      )}
      {usage && !usage.canRecognize && usage.plan === 'free' && !adsEnabled && (
        <Text style={styles.hint}>Reklama nagradzająca jest niedostępna w tym środowisku lub wymaga zgody/konfiguracji. Możesz wrócić po odnowieniu limitu.</Text>
      )}
      {usage?.plan === 'premium' && <Text style={styles.hint}>Kolejne rozpoznanie dostępne po odnowieniu dziennego limitu.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: '#102a21', borderRadius: 14, borderWidth: 1, borderColor: '#285142', padding: 14, marginBottom: 14 },
  label: { color: '#9dbfaa', fontSize: 12 },
  value: { color: '#f3faf4', fontSize: 16, fontWeight: '800', marginTop: 4 },
  hint: { color: '#9dbfaa', fontSize: 11, lineHeight: 16, marginTop: 6 },
  rewardButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: '#8f5b20', borderRadius: 11, marginTop: 10, paddingHorizontal: 12 },
  rewardText: { color: '#fff4df', fontSize: 12, fontWeight: '800' },
});
