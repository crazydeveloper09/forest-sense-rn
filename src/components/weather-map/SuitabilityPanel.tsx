import { StyleSheet, Text, View } from 'react-native';
import type { SuitabilityResult } from '../../suitability';
import type { PotentialSpecies, SuitabilitySummary } from '../../screens/weather-map/useWeatherMap';
import { colors } from '../../theme';

type Props = {
  summary: SuitabilitySummary | null;
  potentialSpecies: PotentialSpecies[];
  suitability: SuitabilityResult | null;
  isPremium?: boolean;
  premiumInsight?: {
    bestWindow: string;
    riskLabel: string;
    microclimate: string;
    hotspots: Array<{ label: string; score: number; habitat: string }>;
  } | null;
  loading: boolean;
  error: boolean;
};

export default function SuitabilityPanel({ summary, potentialSpecies, suitability, isPremium = false, premiumInsight, loading, error }: Props) {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Szczegóły obszaru</Text>
      <Text style={styles.hint}>Wilgotność gleby, tekstura i nachylenie terenu</Text>

      {error && !suitability ? (
        <Text style={styles.empty}>Nie udało się pobrać danych środowiskowych. Sprawdź połączenie i spróbuj odświeżyć.</Text>
      ) : loading && !suitability ? (
        <Text style={styles.empty}>Pobieranie danych dla widocznego obszaru…</Text>
      ) : !suitability ? (
        <Text style={styles.empty}>Przesuń lub przybliż mapę, aby pobrać ocenę widocznego obszaru.</Text>
      ) : summary ? (
        <>
          <View style={styles.metrics}>
            <Metric label="Opady, 72 h" value={summary.rainfall == null ? '—' : `${summary.rainfall.toFixed(1)} mm`} />
            <Metric label="Wilgotność gleby" value={summary.moisture == null ? '—' : `${Math.round(summary.moisture * 100)}%`} />
            <Metric label="Nachylenie" value={summary.slope == null ? '—' : `${summary.slope.toFixed(1)}°`} />
            <Metric label="Tekstura gleby" value={summary.soilTexture ?? 'brak danych'} />
          </View>
          <Text style={styles.dataQuality}>
            {suitability.soilDataAvailable
              ? `Dane gleby: SoilGrids · wysokość terenu: ${summary.elevation == null ? 'brak' : `${Math.round(summary.elevation)} m n.p.m.`}`
              : 'Brak danych SoilGrids dla tego obszaru — ocena korzysta z pogody, wilgotności gleby i rzeźby terenu.'}
          </Text>
          {isPremium && premiumInsight ? (
            <View style={styles.premiumSummary}>
              <Text style={styles.premiumSummaryTitle}>Najlepsze strefy</Text>
              {premiumInsight.hotspots.map((hotspot, index) => (
                <View key={`${hotspot.label}-${hotspot.score}`} style={styles.hotspotLine}>
                  <Text style={styles.hotspotLabel}>{index + 1}. {hotspot.label}</Text>
                  <Text style={styles.hotspotScore}>{hotspot.score}%</Text>
                </View>
              ))}
              <Text style={styles.premiumSummaryText}>{premiumInsight.bestWindow}</Text>
            </View>
          ) : null}
          <Text style={styles.subsectionTitle}>Możliwe gatunki w odpowiednim siedlisku</Text>
          {potentialSpecies.length ? potentialSpecies.map((species) => (
            <View key={species.name} style={styles.speciesRow}>
              <View style={styles.speciesInfo}>
                <Text style={styles.speciesName}>{species.name}</Text>
                <Text style={styles.speciesHabitat}>{species.habitat}</Text>
              </View>
              <Text style={styles.speciesBadge}>możliwe</Text>
            </View>
          )) : (
            <Text style={styles.empty}>Obecne warunki są słabe dla wymienionych gatunków. Wynik jest orientacyjny i zależy też od gatunków drzew.</Text>
          )}
        </>
      ) : null}
      <Text style={styles.disclaimer}>To heurystyczny wskaźnik warunków, a nie prawdopodobieństwo znalezienia grzyba. Nie uwzględnia gatunków drzew, ochrony terenu ani lokalnych zakazów. Zawsze potwierdź gatunek przed spożyciem.</Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  title: { color: colors.text, fontSize: 16, fontWeight: '800' },
  hint: { color: colors.muted, fontSize: 12, marginTop: 4, marginBottom: 12 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  metric: { width: '48%', backgroundColor: colors.inset, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 11 },
  metricLabel: { color: colors.muted, fontSize: 11, marginBottom: 5 },
  metricValue: { color: colors.text, fontSize: 15, fontWeight: '800', textTransform: 'capitalize' },
  dataQuality: { color: '#91b29d', fontSize: 11, lineHeight: 16, marginBottom: 14 },
  premiumSummary: { backgroundColor: colors.inset, borderRadius: 14, borderWidth: 1, borderColor: colors.button, padding: 12, marginBottom: 12 },
  premiumSummaryTitle: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 },
  hotspotLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  hotspotLabel: { color: colors.text, fontSize: 12, fontWeight: '700' },
  hotspotScore: { color: colors.accent, fontSize: 12, fontWeight: '800' },
  premiumSummaryText: { color: '#dfeae3', fontSize: 12, lineHeight: 18, marginTop: 8 },
  subsectionTitle: { color: colors.text, fontSize: 14, fontWeight: '800', marginBottom: 4 },
  empty: { color: '#bfd9c9', fontSize: 13, lineHeight: 20, marginTop: 6 },
  speciesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border },
  speciesInfo: { flex: 1, paddingRight: 12 },
  speciesName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  speciesHabitat: { color: colors.muted, fontSize: 11, marginTop: 4 },
  speciesBadge: { color: colors.accent, fontSize: 13, fontWeight: '800' },
  disclaimer: { color: '#86a391', fontSize: 11, lineHeight: 17, marginTop: 12 },
});
