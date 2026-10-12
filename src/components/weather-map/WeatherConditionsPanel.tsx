import { StyleSheet, Text, View } from 'react-native';
import type { WeatherData } from '../../weather';
import type { SuitabilityResult } from '../../suitability';
import { colors } from '../../theme';

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
  score: number | null;
};

export default function WeatherConditionsPanel({ weather, weatherLoading, weatherError, isPremium = false, premiumInsight, score }: Props) {
  const sentence = isPremium && premiumInsight?.bestWindow
    ? premiumInsight.bestWindow
    : weather?.recommendation
      ?? (weatherError ? 'Brak połączenia z pogodą.' : weatherLoading ? 'Pobieranie pogody…' : 'Włącz lokalizację, aby zobaczyć warunki.');

  return (
    <View>
      <View style={styles.grid}>
        <WeatherMetric label="Temperatura" value={weather ? `${Math.round(weather.temperature)}°` : '—'} />
        <WeatherMetric label="Wilgotność" value={weather ? `${weather.humidity}%` : '—'} />
        <WeatherMetric label="Opady" value={weather ? `${weather.rainfall.toFixed(1)} mm` : '—'} />
        <WeatherMetric label="Wiatr" value={weather ? `${Math.round(weather.wind)} km/h` : '—'} />
      </View>
      <Text style={styles.sentence}>{sentence}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(0, Math.min(score ?? 0, 100))}%` }]} />
      </View>
      {isPremium && premiumInsight ? <Text style={styles.risk}>{premiumInsight.riskLabel}</Text> : null}
    </View>
  );
}

function WeatherMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row' },
  metric: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  metricValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
  metricLabel: { color: colors.muted, fontSize: 11, marginTop: 4 },
  sentence: { color: colors.text, fontSize: 15, lineHeight: 22, marginTop: 14 },
  track: { height: 4, borderRadius: 999, backgroundColor: '#1d4338', marginTop: 14, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 999, backgroundColor: colors.button },
  risk: { color: colors.accent, fontSize: 12, fontWeight: '700', marginTop: 10 },
});
