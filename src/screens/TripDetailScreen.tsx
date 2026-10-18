import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { colors } from '../theme';

type Point = { latitude: number; longitude: number };

type Props = {
  title: string;
  startedAt: string;
  endedAt: string | null;
  distanceMeters: number;
  mushroomCount: number;
  points: Point[];
  onBack: () => void;
  onShare?: () => void;
  shareMessage?: string | null;
};

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function pointsLabel(count: number): string {
  if (count === 1) return '1 punkt trasy';
  const rest = count % 10;
  const hundred = count % 100;
  if (rest >= 2 && rest <= 4 && (hundred < 12 || hundred > 14)) return `${count} punkty trasy`;
  return `${count} punktów trasy`;
}

function formatDuration(startedAt: string, endedAt: string | null, now: number): string {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : now;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return '—';
  const minutes = Math.round((end - start) / 60_000);
  if (minutes < 1) return 'poniżej minuty';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} godz. ${rest} min` : `${hours} godz.`;
}

function regionFor(points: Point[]) {
  const first = points[0] ?? { latitude: 52.2297, longitude: 21.0122 };
  let minLat = first.latitude;
  let maxLat = first.latitude;
  let minLng = first.longitude;
  let maxLng = first.longitude;
  for (const point of points) {
    minLat = Math.min(minLat, point.latitude);
    maxLat = Math.max(maxLat, point.latitude);
    minLng = Math.min(minLng, point.longitude);
    maxLng = Math.max(maxLng, point.longitude);
  }
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.4, 0.01),
    longitudeDelta: Math.max((maxLng - minLng) * 1.4, 0.01),
  };
}

export default function TripDetailScreen({ title, startedAt, endedAt, distanceMeters, mushroomCount, points, onBack, onShare, shareMessage }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [endedAt]);

  const start = points[0];
  const finish = points.length > 1 ? points[points.length - 1] : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable style={styles.back} onPress={onBack} accessibilityRole="button">
        <MaterialCommunityIcons name="arrow-left" size={20} color={colors.text} />
        <Text style={styles.backText}>Wyprawy</Text>
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.when}>{formatWhen(startedAt)}{endedAt ? ` – ${formatWhen(endedAt)}` : ' · w toku'}</Text>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatDuration(startedAt, endedAt, now)}</Text>
          <Text style={styles.statLabel}>Czas</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatDistance(distanceMeters)}</Text>
          <Text style={styles.statLabel}>Dystans</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{mushroomCount}</Text>
          <Text style={styles.statLabel}>Grzyby</Text>
        </View>
      </View>

      <View style={styles.mapFrame} collapsable={false}>
        {points.length ? (
          <MapView
            style={styles.map}
            mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
            loadingBackgroundColor="#143028"
            initialRegion={regionFor(points)}
            rotateEnabled={false}
            pitchEnabled={false}
          >
            {points.length > 1 ? <Polyline coordinates={points} strokeColor="#f2cf58" strokeWidth={4} /> : null}
            {start ? <Marker coordinate={start} title="Start" pinColor="#2d8d62" /> : null}
            {finish ? <Marker coordinate={finish} title="Koniec" pinColor="#f2cf58" /> : null}
          </MapView>
        ) : (
          <Text style={styles.emptyMap}>Ta wyprawa nie ma jeszcze punktów trasy.</Text>
        )}
      </View>
      <Text style={styles.meta}>{pointsLabel(points.length)}</Text>
      {onShare ? (
        <Pressable style={styles.share} onPress={onShare}>
          <Text style={styles.shareText}>Udostępnij zaufanym</Text>
        </Pressable>
      ) : null}
      {shareMessage ? <Text style={styles.note}>{shareMessage}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 12, paddingBottom: 32 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginBottom: 16 },
  backText: { color: colors.text, fontWeight: '800', fontSize: 16 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  when: { color: colors.muted, marginTop: 6, marginBottom: 16, lineHeight: 20 },
  stats: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  stat: {
    flex: 1,
    backgroundColor: colors.sheet,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statValue: { color: colors.text, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  statLabel: { color: colors.muted, fontSize: 12, marginTop: 4 },
  mapFrame: {
    height: 320,
    borderRadius: 18,
    backgroundColor: '#143028',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  map: { ...StyleSheet.absoluteFill },
  emptyMap: { color: colors.muted, textAlign: 'center', paddingHorizontal: 24, lineHeight: 20 },
  meta: { color: colors.muted, marginTop: 10 },
  share: { alignSelf: 'flex-start', marginTop: 16, backgroundColor: '#1a3f33', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  shareText: { color: colors.accent, fontWeight: '800' },
  note: { color: colors.text, marginTop: 12, lineHeight: 20 },
});
