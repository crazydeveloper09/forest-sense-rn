import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { UsageStatus } from '../../billing';
import { colors } from '../../theme';

type Props = {
  usage: UsageStatus | null;
  loading: boolean;
  adLoading: boolean;
  adsEnabled: boolean;
  onWatchAd: () => void;
};

export default function RecognitionQuotaPanel({ usage, loading, adLoading, adsEnabled, onWatchAd }: Props) {
  const label = loading || !usage
    ? 'Sprawdzam limit…'
    : usage.plan === 'premium'
      ? `${usage.dailyUsed} z ${usage.dailyLimit} dzisiaj`
      : `${usage.monthlyUsed} z ${usage.monthlyLimit} w tym miesiącu`;
  const showReward = Boolean(usage && !usage.canRecognize && usage.plan === 'free' && adsEnabled);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}{usage?.rewardCredits ? ` · +${usage.rewardCredits}` : ''}</Text>
      {showReward ? (
        <Pressable onPress={onWatchAd} disabled={adLoading} accessibilityRole="button">
          <Text style={styles.action}>{adLoading ? 'Ładuję…' : 'Reklama +1'}</Text>
        </Pressable>
      ) : null}
      {usage && !usage.canRecognize && usage.plan === 'free' && !adsEnabled ? (
        <Text style={styles.hint}>Reklama niedostępna</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700' },
  action: { color: colors.accent, fontSize: 13, fontWeight: '800' },
  hint: { color: colors.muted, fontSize: 12 },
});
