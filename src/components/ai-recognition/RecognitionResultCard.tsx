import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MushroomIdentification } from '../../ai';

type Props = {
  result: MushroomIdentification | null;
  isAnalyzing: boolean;
  error: string | null;
  sourceMode: 'camera' | 'gallery' | 'none';
  locationLabel: string;
  saved: boolean;
  isPremium: boolean;
  onSave: () => void;
};

export default function RecognitionResultCard({ result, isAnalyzing, error, sourceMode, locationLabel, saved, isPremium, onSave }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.badge}>{isAnalyzing ? 'Analizuję zdjęcie…' : result?.identified ? 'Wstępny wynik AI' : result ? 'Nie rozpoznano' : 'Gotowe do analizy'}</Text>
      {isAnalyzing ? (
        <Text style={styles.description}>Zdjęcie jest wysyłane do modelu AI. To może potrwać kilka sekund.</Text>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : result ? (
        <>
          <Text style={styles.name}>{result.name}</Text>
          <Text style={styles.confidence}>Podobieństwo wizualne: {result.confidence}% · nie jest to pewność ani prawdopodobieństwo</Text>
          <Text style={styles.description}>{result.description}</Text>
        </>
      ) : (
        <Text style={styles.description}>Zrób zdjęcie lub wybierz je z galerii. Rozpoznanie uruchomi się automatycznie.</Text>
      )}
      <View style={styles.sourceRow}>
        <Text style={styles.sourceLabel}>Źródło zdjęcia</Text>
        <Text style={styles.sourceValue}>{sourceMode === 'camera' ? 'Aparat' : sourceMode === 'gallery' ? 'Galeria' : 'Brak'}</Text>
      </View>
      <Metadata label="Środowisko" value={result?.habitat ?? 'Określane po analizie zdjęcia'} />
      <Metadata label="Lokalizacja" value={locationLabel} />
      <Pressable
        style={[styles.saveButton, (!result?.identified || saved || !isPremium) && styles.disabled]}
        onPress={onSave}
        disabled={!result?.identified || saved || !isPremium}
      >
        <Text style={styles.saveText}>{saved ? 'Zapisano obserwację' : isPremium ? 'Zapisz obserwację' : 'Premium: Zapisz obserwację'}</Text>
      </Pressable>
    </View>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metadata}>
      <Text style={styles.metadataLabel}>{label}</Text>
      <Text style={styles.metadataValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#0f251d', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#1d3d34', marginBottom: 16 },
  badge: { color: '#daf7d7', backgroundColor: '#1d4337', alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, fontSize: 12, fontWeight: '700', marginBottom: 12 },
  name: { color: '#f3faf4', fontSize: 26, fontWeight: '800', marginBottom: 4 },
  confidence: { color: '#a7ebb0', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  description: { color: '#dfeae3', fontSize: 14, lineHeight: 22, marginBottom: 16 },
  error: { color: '#ffb4a7', fontSize: 14, lineHeight: 21, marginBottom: 14 },
  sourceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#102a21', borderRadius: 12, borderWidth: 1, borderColor: '#1b3e34', padding: 12, marginBottom: 8 },
  sourceLabel: { color: '#9dbfaa', fontSize: 12 },
  sourceValue: { color: '#f3faf4', fontWeight: '700' },
  metadata: { backgroundColor: '#102a21', borderRadius: 14, borderWidth: 1, borderColor: '#1b3e34', padding: 12, marginBottom: 8 },
  metadataLabel: { color: '#9dbfaa', fontSize: 12, marginBottom: 4 },
  metadataValue: { color: '#f3faf4', fontWeight: '700' },
  saveButton: { backgroundColor: '#2d8d62', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  saveText: { color: '#f6fff9', fontWeight: '800' },
  disabled: { opacity: 0.45 },
});
