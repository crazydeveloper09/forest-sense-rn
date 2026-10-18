import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getActiveTrip, subscribeTrips, type StoredTrip } from '../../db';
import { colors } from '../../theme';
import { changeMushroomCount, finishTrip, resumeActiveTrip, startTrip } from '../../trips/tracker';
import { syncTrips } from '../../trips/sync';

type Props = {
  origin: { latitude: number; longitude: number } | null;
};

function formatDuration(startedAt: string, endedAt: string | null, now: number): string {
  const end = endedAt ? Date.parse(endedAt) : now;
  const seconds = Math.max(0, Math.floor((end - Date.parse(startedAt)) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return [hours, minutes, rest].map((part) => String(part).padStart(2, '0')).join(':');
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export default function TripControls({ origin }: Props) {
  const [trip, setTrip] = useState<StoredTrip | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const load = () => setTrip(getActiveTrip());
    load();
    resumeActiveTrip();
    return subscribeTrips(load);
  }, []);

  useEffect(() => {
    if (!trip) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [trip]);

  if (!trip) {
    return (
      <Pressable
        style={styles.start}
        accessibilityRole="button"
        accessibilityLabel="Rozpocznij wyprawę"
        onPress={() => void startTrip(origin).then(() => syncTrips().catch(() => undefined))}
      >
        <MaterialCommunityIcons name="play" size={18} color="#10271e" />
        <Text style={styles.startText}>Start</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.panel}>
      <View style={styles.stats}>
        <Text style={styles.value}>{formatDuration(trip.startedAt, null, now)}</Text>
        <Text style={styles.label}>Czas</Text>
      </View>
      <View style={styles.stats}>
        <Text style={styles.value}>{formatDistance(trip.distanceMeters)}</Text>
        <Text style={styles.label}>Dystans</Text>
      </View>
      <View style={styles.stats}>
        <Text style={styles.value}>{trip.mushroomCount}</Text>
        <Text style={styles.label}>Grzyby</Text>
      </View>
      <Pressable style={styles.countButton} onPress={() => changeMushroomCount(-1)} accessibilityLabel="Odejmij grzyba">
        <Text style={styles.countText}>−</Text>
      </Pressable>
      <Pressable style={styles.countButton} onPress={() => changeMushroomCount(1)} accessibilityLabel="Dodaj grzyba">
        <Text style={styles.countText}>+</Text>
      </Pressable>
      <Pressable
        style={styles.stop}
        onPress={() => {
          finishTrip();
          void syncTrips().catch(() => undefined);
        }}
        accessibilityLabel="Zakończ wyprawę"
      >
        <MaterialCommunityIcons name="stop" size={18} color="#fff7f4" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  start: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  startText: { color: '#10271e', fontWeight: '800', fontSize: 15 },
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(8, 26, 20, 0.92)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stats: { minWidth: 58 },
  value: { color: '#f4fff6', fontWeight: '800', fontSize: 14 },
  label: { color: '#b7d4c4', fontSize: 10, marginTop: 2 },
  countButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a3f33',
  },
  countText: { color: colors.accent, fontSize: 20, fontWeight: '800' },
  stop: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8d3b32',
  },
});
