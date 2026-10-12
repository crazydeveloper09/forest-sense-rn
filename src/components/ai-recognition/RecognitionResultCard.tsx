import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MushroomIdentification } from '../../ai';
import { colors } from '../../theme';

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

export default function RecognitionResultCard({ result, isAnalyzing, error, locationLabel, saved, isPremium, onSave }: Props) {
  if (!isAnalyzing && !error && !result) return null;

  const badge = isAnalyzing ? 'Analizuję' : error ? 'Błąd' : result?.identified ? 'Prawdopodobne' : 'Nie rozpoznano';
  const habitat = result?.habitat || locationLabel;

  return (
    <View style={styles.card}>
      <Text style={styles.badge}>{badge}</Text>
      {isAnalyzing ? (
        <Text style={styles.description}>Zdjęcie jest wysyłane do modelu. To może potrwać kilka sekund.</Text>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : result ? (
        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <Text style={styles.name}>{result.name}</Text>
            <Text style={styles.habitat}>{habitat}</Text>
          </View>
          <Text style={styles.confidence}>{result.confidence}%</Text>
        </View>
      ) : null}
      {result?.description ? <Text style={styles.description}>{result.description}</Text> : null}
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.sheet,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  badge: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    backgroundColor: colors.button,
    color: colors.buttonText,
    fontSize: 12,
    fontWeight: '800',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    marginBottom: 10,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titleCopy: { flex: 1 },
  name: { color: colors.text, fontSize: 26, fontWeight: '800' },
  habitat: { color: colors.muted, fontSize: 13, marginTop: 4 },
  confidence: { color: colors.accent, fontSize: 28, fontWeight: '800' },
  description: { color: '#dfeae3', fontSize: 14, lineHeight: 21, marginTop: 10 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 21 },
  saveButton: { backgroundColor: colors.button, paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginTop: 14 },
  saveText: { color: colors.buttonText, fontWeight: '800' },
  disabled: { opacity: 0.45 },
});
