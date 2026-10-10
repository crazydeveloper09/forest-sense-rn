import { StyleSheet, Text, View } from 'react-native';

const nearbySpecies = [
  { name: 'Borowik szlachetny', chance: '96%', zone: 'Sosnowy las' },
  { name: 'Maślak zwyczajny', chance: '88%', zone: 'Wilgotny teren' },
  { name: 'Krowiak podwinięty', chance: '74%', zone: 'Lokalne polany' },
];

export default function NearbySpeciesList() {
  return (
    <View style={styles.listCard}>
      <Text style={styles.sectionTitle}>Najbardziej prawdopodobne</Text>
      {nearbySpecies.map((species) => (
        <View key={species.name} style={styles.speciesRow}>
          <View>
            <Text style={styles.speciesName}>{species.name}</Text>
            <Text style={styles.speciesZone}>{species.zone}</Text>
          </View>
          <Text style={styles.speciesChance}>{species.chance}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  listCard: {
    backgroundColor: '#0f251d',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1d3d34',
  },
  sectionTitle: { color: '#f2f9f3', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  speciesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#193d33',
  },
  speciesName: { color: '#f0f8f2', fontWeight: '600', marginBottom: 4 },
  speciesZone: { color: '#9bbdac', fontSize: 12 },
  speciesChance: { color: '#aef0a0', fontSize: 18, fontWeight: '800' },
});
