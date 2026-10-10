import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  expanded: boolean;
  onToggle: () => void;
};

export default function SettingsPlanCard({ expanded, onToggle }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View>
          <Text style={styles.cardLabel}>Plan</Text>
          <Text style={styles.cardTitle}>Premium</Text>
        </View>
        <View style={styles.badgePill}>
          <Text style={styles.badgeText}>Pro</Text>
        </View>
      </View>
      <Text style={styles.cardText}>Zarządzaj subskrypcją, sprawdzaj status i korzystaj z dodatkowych funkcji aplikacji.</Text>
      <Pressable style={styles.primaryButton} onPress={onToggle}>
        <Text style={styles.primaryButtonText}>{expanded ? 'Ukryj szczegóły Premium' : 'Przejdź do Premium'}</Text>
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
    padding: 18,
    marginBottom: 16,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardLabel: {
    color: '#9ec0ae',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  cardTitle: { color: '#f3faf4', fontSize: 24, fontWeight: '800' },
  badgePill: { backgroundColor: '#1c4337', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
  badgeText: { color: '#dffced', fontSize: 11, fontWeight: '800' },
  cardText: { color: '#dfeae3', fontSize: 14, lineHeight: 22, marginBottom: 16 },
  primaryButton: { backgroundColor: '#2d8d62', borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  primaryButtonText: { color: '#f5fff7', fontWeight: '800', fontSize: 15 },
});
