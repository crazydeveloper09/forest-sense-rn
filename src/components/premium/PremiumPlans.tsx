import { StyleSheet, Text, View } from 'react-native';

const freeFeatures = [
  'Mapa występowania grzybów',
  'Podstawowa prognoza warunków',
  '10 rozpoznań AI w miesiącu',
  'Podstawowe informacje o gatunkach',
  'Banery AdMob i nagroda za reklamę po wykorzystaniu limitu',
];

const premiumFeatures = [
  'Brak reklam',
  '1 rozpoznanie AI dziennie',
  'Bardziej szczegółowa mapa',
  'Szczegółowa prognoza warunków',
  'Powiadomienia o dobrych warunkach',
  'Historia obserwacji offline',
  'Udostępnianie trasy wyprawy zaufanym',
];

function PlanColumn({ title, price, items, highlighted }: { title: string; price: string; items: string[]; highlighted?: boolean }) {
  return (
    <View style={[styles.planCard, highlighted && styles.planCardPremium]}>
      <Text style={styles.planTitle}>{title}</Text>
      <Text style={styles.planPrice}>{price}</Text>
      {items.map((item) => (
        <Text key={item} style={styles.planItem}>• {item}</Text>
      ))}
    </View>
  );
}

export default function PremiumPlans() {
  return (
    <View style={styles.planRow}>
      <PlanColumn title="Darmowa" price="0 zł" items={freeFeatures} />
      <PlanColumn title="Premium" price="25 zł / msc" items={premiumFeatures} highlighted />
    </View>
  );
}

const styles = StyleSheet.create({
  planRow: { flexDirection: 'row', gap: 12 },
  planCard: {
    flex: 1,
    backgroundColor: '#0f251d',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1d3d34',
    padding: 16,
  },
  planCardPremium: { backgroundColor: '#132f27', borderColor: '#5cc88f' },
  planTitle: { color: '#f3faf4', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  planPrice: { color: '#a8e9af', fontWeight: '700', marginBottom: 12 },
  planItem: { color: '#dfeae3', fontSize: 12, lineHeight: 20 },
});
