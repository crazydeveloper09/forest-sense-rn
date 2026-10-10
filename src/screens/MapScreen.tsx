import { ScrollView, StyleSheet, Text, View } from 'react-native';
import NearbySpeciesList from '../components/map/NearbySpeciesList';
import OccurrenceHeatmap from '../components/map/OccurrenceHeatmap';

const summary = [
  { value: '87%', label: 'Warunki' },
  { value: '19', label: 'Gatunki' },
  { value: '3', label: 'Alerty' },
];

export default function MapScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Mapa występowania</Text>
      <OccurrenceHeatmap />
      <View style={styles.summaryRow}>
        {summary.map((item) => (
          <View key={item.label} style={styles.summaryBox}>
            <Text style={styles.summaryValue}>{item.value}</Text>
            <Text style={styles.summaryLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
      <NearbySpeciesList />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#081a14' },
  content: { padding: 20, paddingTop: 32 },
  title: { color: '#edf9f0', fontSize: 28, fontWeight: '800', marginBottom: 18 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  summaryBox: {
    flex: 1,
    backgroundColor: '#0f251d',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1d3d34',
    alignItems: 'center',
  },
  summaryValue: { color: '#f2faf3', fontSize: 22, fontWeight: '800' },
  summaryLabel: { color: '#aad0b9', fontSize: 12, marginTop: 4 },
});
