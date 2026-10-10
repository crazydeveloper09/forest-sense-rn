import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { WeatherData } from '../../weather';
import type { SuitabilityResult } from '../../suitability';

export type Props = {
  weather: WeatherData | null;
  weatherLoading: boolean;
  weatherError: boolean;
  suitability: SuitabilityResult | null;
  isPremium?: boolean;
  premiumInsight?: {
    bestWindow: string;
    riskLabel: string;
    microclimate: string;
    hotspots: Array<{ label: string; score: number; habitat: string }>;
  } | null;
  onRefresh: () => void;
  disabled: boolean;
};

export default function WeatherConditionsPanel({ weather, weatherLoading, weatherError, suitability, isPremium = false, premiumInsight, onRefresh, disabled }: Props) {
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Warunki lokalne</Text>
        <Pressable accessibilityRole="button" onPress={onRefresh} disabled={disabled}>
          <Text style={[styles.refreshText, disabled && styles.disabledText]}>{disabled ? 'Aktualizuję…' : 'Odśwież'}</Text>
        </Pressable>
      </View>
      <View style={styles.grid}>
        <WeatherMetric label="Temp." value={weather ? `${Math.round(weather.temperature)}°C` : '—'} />
        <WeatherMetric label="Wilgoć powietrza" value={weather ? `${weather.humidity}%` : '—'} />
        <WeatherMetric label="Opady" value={weather ? `${weather.rainfall.toFixed(1)} mm` : '—'} />
        <WeatherMetric label="Wiatr" value={weather ? `${Math.round(weather.wind)} km/h` : '—'} />
      </View>
      <Text style={styles.condition}>{weather?.condition ?? (weatherError ? 'Brak połączenia z pogodą' : 'Pobieranie pogody…')}</Text>
      {weather && <Text style={styles.recommendation}>{weather.recommendation}</Text>}
      {isPremium && premiumInsight ? (
        <View style={styles.premiumBox}>
          <Text style={styles.premiumLabel}>Premium insight</Text>
          <Text style={styles.premiumMain}>{premiumInsight.bestWindow}</Text>
          <Text style={styles.premiumText}>{premiumInsight.microclimate}</Text>
          <Text style={styles.premiumRisk}>Ryzyko: {premiumInsight.riskLabel}</Text>
          <View style={styles.hotspotRow}>
            {premiumInsight.hotspots.map((hotspot, index) => (
              <View key={`${hotspot.label}-${hotspot.score}`} style={styles.hotspotChip}>
                <Text style={styles.hotspotName}>{index + 1}. {hotspot.label}</Text>
                <Text style={styles.hotspotScore}>{hotspot.score}%</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      <Text style={styles.updatedText}>
        {weather
          ? `Dane pogodowe: ${new Date(weather.updatedAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })} · odświeżanie co 15 min`
          : 'Pogoda z Open-Meteo · wymagana lokalizacja i internet'}
      </Text>
      <Text style={styles.updatedText}>
        {suitability
          ? `Model: ${new Date(suitability.updatedAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })} · odświeżanie co 30 min · gleba i teren są statyczne`
          : 'Model środowiskowy · odświeżanie co 30 min'}
      </Text>
    </View>
  );
}

function WeatherMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: '#102d24', borderRadius: 18, borderWidth: 1, borderColor: '#1d4338', padding: 16, marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { color: '#f2f9f3', fontSize: 17, fontWeight: '800' },
  refreshText: { color: '#aef0a0', fontWeight: '700', fontSize: 13 },
  disabledText: { opacity: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  metric: { width: '48%', backgroundColor: '#0d2019', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#1a3b31' },
  metricLabel: { color: '#9dbfaa', fontSize: 12, marginBottom: 6 },
  metricValue: { color: '#f3faf5', fontSize: 20, fontWeight: '800' },
  condition: { marginTop: 14, color: '#aef0a0', fontSize: 18, fontWeight: '800' },
  recommendation: { marginTop: 8, color: '#dfeae3', fontSize: 14, lineHeight: 22 },
  premiumBox: { marginTop: 14, backgroundColor: '#0d2019', borderRadius: 14, borderWidth: 1, borderColor: '#2d8d62', padding: 12 },
  premiumLabel: { color: '#aef0a0', fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  premiumMain: { color: '#f3faf4', fontSize: 14, fontWeight: '800', lineHeight: 22 },
  premiumText: { color: '#dfeae3', fontSize: 12, lineHeight: 18, marginTop: 6 },
  premiumRisk: { color: '#9fe6b8', fontSize: 12, fontWeight: '700', marginTop: 8 },
  hotspotRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 8 },
  hotspotChip: { backgroundColor: '#143a2d', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#2a5848' },
  hotspotName: { color: '#edf9f1', fontSize: 10, fontWeight: '700' },
  hotspotScore: { color: '#aef0a0', fontSize: 11, fontWeight: '800' },
  updatedText: { marginTop: 8, color: '#8eaf9c', fontSize: 11 },
});
