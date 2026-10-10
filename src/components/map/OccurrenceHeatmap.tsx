import { StyleSheet, Text, View, type DimensionValue } from 'react-native';

const heatZones: Array<{ id: number; x: DimensionValue; y: DimensionValue; color: string; size: number }> = [
  { id: 1, x: '15%', y: '18%', color: '#1f4a3f', size: 52 },
  { id: 2, x: '34%', y: '38%', color: '#2d6950', size: 62 },
  { id: 3, x: '52%', y: '26%', color: '#4fa96d', size: 70 },
  { id: 4, x: '68%', y: '58%', color: '#7bd57f', size: 58 },
  { id: 5, x: '76%', y: '32%', color: '#f1ba6a', size: 42 },
  { id: 6, x: '48%', y: '70%', color: '#d9a04d', size: 54 },
];

export default function OccurrenceHeatmap() {
  return (
    <View style={styles.mapCard}>
      <View style={styles.mapBackground}>
        {heatZones.map((zone) => (
          <View
            key={zone.id}
            style={[
              styles.heatZone,
              {
                left: zone.x,
                top: zone.y,
                width: zone.size,
                height: zone.size,
                backgroundColor: zone.color,
              },
            ]}
          />
        ))}
        <View style={styles.userMarker}>
          <Text style={styles.userMarkerText}>Ty</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapCard: {
    backgroundColor: '#102d24',
    borderRadius: 24,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1f483d',
    marginBottom: 18,
  },
  mapBackground: {
    position: 'relative',
    height: 260,
    borderRadius: 18,
    backgroundColor: '#0b2018',
    overflow: 'hidden',
  },
  heatZone: { position: 'absolute', borderRadius: 999, opacity: 0.8 },
  userMarker: {
    position: 'absolute',
    right: 24,
    bottom: 20,
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: '#edf6ed',
    borderWidth: 2,
    borderColor: '#204d3e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMarkerText: { color: '#183c2d', fontWeight: '700', fontSize: 12 },
});
