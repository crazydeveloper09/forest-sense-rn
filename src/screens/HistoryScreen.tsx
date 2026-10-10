import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import HistoryEntry from '../components/history/HistoryEntry';
import HistoryLocked from '../components/history/HistoryLocked';
import { getOfflineObservations, subscribeOfflineObservations } from '../storage';
import type { ObservationRecord } from '../types';

type Props = { isPremium: boolean };

export default function HistoryScreen({ isPremium }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<ObservationRecord[]>([]);

  useEffect(() => {
    if (!isPremium) return;
    const load = () => setItems(getOfflineObservations(user?.id));
    load();
    return subscribeOfflineObservations(load);
  }, [isPremium, user?.id]);

  if (!isPremium) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.lockedContent}>
        <Text style={styles.title}>Historia obserwacji</Text>
        <HistoryLocked />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Historia obserwacji</Text>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#081a14' },
  content: { padding: 20, paddingTop: 30, paddingBottom: 32 },
  lockedContent: { padding: 20, paddingTop: 30, paddingBottom: 32, justifyContent: 'center', flexGrow: 1 },
  title: { color: '#edf9f1', fontSize: 28, fontWeight: '800', marginBottom: 18 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  summaryBox: {
    flex: 1,
    backgroundColor: '#0f251d',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1d3d34',
    padding: 14,
    alignItems: 'center',
  },
  summaryValue: { color: '#f3faf4', fontSize: 24, fontWeight: '800' },
  summaryLabel: { color: '#a8d0b8', fontSize: 12, marginTop: 4 },
});
