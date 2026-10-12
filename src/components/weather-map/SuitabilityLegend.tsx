import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme';

const levels = [
  { color: '#5ccd7b', label: 'lepsze warunki' },
  { color: '#c1da5e', label: 'umiarkowane' },
  { color: '#ef7852', label: 'słabsze warunki' },
];

export default function SuitabilityLegend() {
  return (
    <View style={styles.row}>
      {levels.map((level) => (
        <View key={level.label} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: level.color }]} />
          <Text style={styles.label}>{level.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 14 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { color: colors.muted, fontSize: 11 },
});
