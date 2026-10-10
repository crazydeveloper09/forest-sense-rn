import { StyleSheet, Text, View } from 'react-native';

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
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingVertical: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { color: '#b2cbbb', fontSize: 11 },
});
