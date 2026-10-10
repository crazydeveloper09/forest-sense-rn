import { StyleSheet, Text, View } from 'react-native';
import type { ObservationRecord } from '../../types';

export default function HistoryEntry({ item }: { item: ObservationRecord }) {
  return (
    <View style={styles.entryCard}>
      <View style={styles.entryHeader}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.score}>{item.probability}%</Text>
      </View>
      <Text style={styles.note}>{item.notes}</Text>
      <Text style={styles.date}>
        {new Date(item.createdAt).toLocaleString('pl-PL', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  entryCard: {
    backgroundColor: '#0f251d',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1d3d34',
    padding: 16,
    marginBottom: 12,
  },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  name: { color: '#eefaf0', fontSize: 18, fontWeight: '700' },
  score: { color: '#aef0a0', fontSize: 18, fontWeight: '800' },
  note: { color: '#dfeae3', fontSize: 14, lineHeight: 22, marginBottom: 12 },
  date: { color: '#9dc0ad', fontSize: 12 },
});
