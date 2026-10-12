import { StyleSheet, Text, View } from 'react-native';
import type { MushroomCandidate } from '../../ai';
import { colors } from '../../theme';

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
  card: { gap: 8 },
  title: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { flex: 1, color: colors.text, fontWeight: '600', paddingRight: 12 },
  confidence: { color: colors.accent, fontWeight: '800' },
});
