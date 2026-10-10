import { StyleSheet, Text, View } from 'react-native';
import type { MushroomCandidate } from '../../ai';

type Props = { candidates: MushroomCandidate[] };

export default function RecognitionAlternatives({ candidates }: Props) {
  if (!candidates.length) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Inne możliwe gatunki</Text>
      {candidates.map((candidate) => (
        <View key={candidate.name} style={styles.row}>
          <Text style={styles.name}>{candidate.name}</Text>
          <Text style={styles.confidence}>{candidate.confidence}%</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#102d24', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#1e4338' },
  title: { color: '#edf9f1', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  row: { backgroundColor: '#0d2019', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#1d3d34', marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { flex: 1, color: '#f2faf3', fontWeight: '600', paddingRight: 12 },
  confidence: { color: '#a9ffb0', fontWeight: '800' },
});
