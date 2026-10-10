import { StyleSheet, Text, View } from 'react-native';

export default function HistoryLocked() {
  return (
    <View style={styles.lockCard}>
      <Text style={styles.lockBadge}>Premium</Text>
      <Text style={styles.lockTitle}>Historia jest dostępna tylko w planie Premium</Text>
      <Text style={styles.lockText}>Zapisz wyniki rozpoznania AI i przeglądaj wcześniejsze obserwacje offline po aktywacji Premium.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lockCard: {
    backgroundColor: '#102d24',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#224d3f',
    padding: 18,
  },
  lockBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#1b4336',
    color: '#dffced',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '800',
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  lockTitle: { color: '#f3faf4', fontSize: 20, fontWeight: '800', marginBottom: 10 },
  lockText: { color: '#dfeae3', fontSize: 14, lineHeight: 22 },
});
