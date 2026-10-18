import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import HistoryEntry from '../components/history/HistoryEntry';
import HistoryLocked from '../components/history/HistoryLocked';
import { postJson } from '../api/http';
import { getTrips, subscribeTrips, type StoredTrip } from '../db';
import { getOfflineObservations, subscribeOfflineObservations } from '../storage';
import TripDetailScreen from './TripDetailScreen';
import type { ObservationRecord } from '../types';
import { colors } from '../theme';

type Props = { isPremium: boolean };
type Mode = 'trips' | 'observations';
type SharedTrip = {
  id: string;
  ownerLabel: string;
  startedAt: string;
  endedAt: string | null;
  distanceMeters: number;
  mushroomCount: number;
  points: Array<{ latitude: number; longitude: number }>;
};
type TrustRequest = { id: string; userId: string; status: string; label: string; direction: 'outgoing' | 'incoming' };

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function HistoryScreen({ isPremium }: Props) {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>('trips');
  const [items, setItems] = useState<ObservationRecord[]>([]);
  const [trips, setTrips] = useState<StoredTrip[]>([]);
  const [shared, setShared] = useState<SharedTrip[]>([]);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [openTripId, setOpenTripId] = useState<string | null>(null);
  const [openSharedId, setOpenSharedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isPremium) return;
    const load = () => setItems(getOfflineObservations(user?.id));
    load();
    return subscribeOfflineObservations(load);
  }, [isPremium, user?.id]);

  useEffect(() => {
    const load = () => setTrips(getTrips(user?.id));
    load();
    return subscribeTrips(load);
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      setShared([]);
      return;
    }
    if (!isPremium) {
      setShared([]);
      return;
    }
    let mounted = true;
    postJson<{ trips: SharedTrip[] }>('/trips/inbox', {}, true)
      .then((response) => {
        if (mounted) setShared(response.trips);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [user, isPremium]);

  async function share(trip: StoredTrip) {
    setShareMessage(null);
    try {
      const response = await postJson<{ requests: TrustRequest[] }>('/trusted/list', {}, true);
      const friends = response.requests.filter((request) => request.direction === 'outgoing' && request.status === 'accepted');
      if (!friends.length) {
        setShareMessage('Najpierw dodaj zaufaną osobę w Ustawieniach i poczekaj, aż zaakceptuje prośbę.');
        return;
      }
      await Promise.all(friends.map((friend) => postJson('/trips/share', {
        tripId: trip.clientId,
        recipientUserId: friend.userId,
        ownerLabel: user?.displayName || 'Użytkownik Forest Sense',
        startedAt: trip.startedAt,
        endedAt: trip.endedAt,
        distanceMeters: trip.distanceMeters,
        mushroomCount: trip.mushroomCount,
        points: trip.points.slice(-500),
      }, true)));
      setShareMessage(`Trasa wysłana do ${friends.length === 1 ? 'zaufanej osoby' : `${friends.length} zaufanych osób`}.`);
    } catch (error) {
      setShareMessage(error instanceof Error ? error.message : 'Nie udało się udostępnić trasy.');
    }
  }

  const openTrip = openTripId ? trips.find((trip) => trip.clientId === openTripId) : null;
  const openShared = openSharedId ? shared.find((trip) => trip.id === openSharedId) : null;
  if (openTrip) {
    return (
      <TripDetailScreen
        title={openTrip.endedAt ? formatWhen(openTrip.startedAt) : 'Wyprawa w toku'}
        startedAt={openTrip.startedAt}
        endedAt={openTrip.endedAt}
        distanceMeters={openTrip.distanceMeters}
        mushroomCount={openTrip.mushroomCount}
        points={openTrip.points}
        onBack={() => setOpenTripId(null)}
        onShare={isPremium && openTrip.endedAt ? () => void share(openTrip) : undefined}
        shareMessage={shareMessage}
      />
    );
  }
  if (openShared) {
    return (
      <TripDetailScreen
        title={openShared.ownerLabel || 'Udostępniona wyprawa'}
        startedAt={openShared.startedAt}
        endedAt={openShared.endedAt}
        distanceMeters={openShared.distanceMeters}
        mushroomCount={openShared.mushroomCount}
        points={openShared.points ?? []}
        onBack={() => setOpenSharedId(null)}
      />
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.switcher}>
        <Pressable style={[styles.switch, mode === 'trips' && styles.switchActive]} onPress={() => setMode('trips')}>
          <Text style={[styles.switchText, mode === 'trips' && styles.switchTextActive]}>Wyprawy</Text>
        </Pressable>
        <Pressable style={[styles.switch, mode === 'observations' && styles.switchActive]} onPress={() => setMode('observations')}>
          <Text style={[styles.switchText, mode === 'observations' && styles.switchTextActive]}>Obserwacje</Text>
        </Pressable>
      </View>

      {mode === 'observations' ? (
        !isPremium ? (
          <HistoryLocked />
        ) : (
          <>
            <View style={styles.summaryRow}>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryValue}>{items.length}</Text>
                <Text style={styles.summaryLabel}>Zapisów</Text>
              </View>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryValue}>{items[0]?.probability ?? 0}%</Text>
                <Text style={styles.summaryLabel}>Najwyższy wynik</Text>
              </View>
            </View>
            {items.map((item) => <HistoryEntry key={item.id} item={item} />)}
          </>
        )
      ) : (
        <>
          {trips.length === 0 ? <Text style={styles.empty}>Nie masz jeszcze wypraw. Na mapie naciśnij Start.</Text> : null}
          {trips.map((trip) => (
            <Pressable key={trip.clientId} style={styles.card} onPress={() => setOpenTripId(trip.clientId)}>
              <Text style={styles.cardTitle}>{trip.endedAt ? formatWhen(trip.startedAt) : 'Wyprawa w toku'}</Text>
              <Text style={styles.cardMeta}>{formatDistance(trip.distanceMeters)} · {trip.mushroomCount} grzybów · {trip.points.length} punktów trasy</Text>
              {isPremium && trip.endedAt ? (
                <Pressable style={styles.share} onPress={() => void share(trip)}>
                  <Text style={styles.shareText}>Udostępnij zaufanym</Text>
                </Pressable>
              ) : null}
            </Pressable>
          ))}
          {shareMessage ? <Text style={styles.note}>{shareMessage}</Text> : null}
          {shared.length ? <Text style={styles.section}>Udostępnione Tobie</Text> : null}
          {shared.map((trip) => (
            <Pressable key={trip.id} style={styles.card} onPress={() => setOpenSharedId(trip.id)}>
              <Text style={styles.cardTitle}>{trip.ownerLabel}</Text>
              <Text style={styles.cardMeta}>{formatWhen(trip.startedAt)} · {formatDistance(trip.distanceMeters)} · {trip.mushroomCount} grzybów</Text>
            </Pressable>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 20, paddingBottom: 32 },
  switcher: { flexDirection: 'row', backgroundColor: '#10271e', borderRadius: 14, padding: 4, marginBottom: 18 },
  switch: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 11 },
  switchActive: { backgroundColor: '#1a3f33' },
  switchText: { color: '#9dbfaa', fontWeight: '800' },
  switchTextActive: { color: colors.accent },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  summaryBox: {
    flex: 1,
    backgroundColor: colors.sheet,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    alignItems: 'center',
  },
  summaryValue: { color: colors.text, fontSize: 24, fontWeight: '800' },
  summaryLabel: { color: colors.muted, fontSize: 12, marginTop: 4 },
  empty: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  card: {
    backgroundColor: colors.sheet,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  cardMeta: { color: colors.muted, marginTop: 6, lineHeight: 20 },
  share: { alignSelf: 'flex-start', marginTop: 10, backgroundColor: '#1a3f33', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  shareText: { color: colors.accent, fontWeight: '800', fontSize: 13 },
  note: { color: colors.text, marginBottom: 12, lineHeight: 20 },
  section: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 8, marginBottom: 12 },
});
