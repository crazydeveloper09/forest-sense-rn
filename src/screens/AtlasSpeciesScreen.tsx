import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { remoteCard, toCard, type AtlasCard } from '../atlas/cards';
import {
  fetchNearbyObservationCount,
  fetchPolishWikipediaExtract,
  fetchRecentPlaces,
  fetchSimilarTaxa,
  fetchTaxonProfile,
} from '../inat';
import HtmlText from '../components/HtmlText';
import { categoryLabel, MUSHROOM_ATLAS } from '../mushroomAtlas';
import { colors } from '../theme';

const NEARBY_RADIUS_KM = 30;

type NearbyState =
  | { status: 'loading' }
  | { status: 'denied' }
  | { status: 'found'; count: number }
  | { status: 'absent' }
  | { status: 'error' };

type Props = {
  card: AtlasCard;
  onBack: () => void;
  onOpen: (card: AtlasCard) => void;
};

export default function AtlasSpeciesScreen({ card, onBack, onOpen }: Props) {
  const [description, setDescription] = useState(card.description);
  const [descriptionSource, setDescriptionSource] = useState(card.local ? 'Katalog Forest Sense' : 'iNaturalist');
  const [range, setRange] = useState<string | null>(null);
  const [places, setPlaces] = useState<string[]>([]);
  const [similar, setSimilar] = useState<AtlasCard[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [nearby, setNearby] = useState<NearbyState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setDescription(card.description);
    setDescriptionSource(card.local ? 'Katalog Forest Sense' : 'iNaturalist');
    setRange(null);
    setPlaces([]);
    setSimilar(localSimilar(card));
    setDetailsLoading(true);
    setDetailsError(null);
    setNearby({ status: 'loading' });

    void loadDetails(card, controller.signal)
      .then((details) => {
        if (controller.signal.aborted || !details) return;
        if (details.description) {
          setDescription(details.description);
          setDescriptionSource(details.descriptionSource);
        }
        setRange(details.range);
        setPlaces(details.places);
        if (details.similar.length) setSimilar(details.similar);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setDetailsError(error instanceof Error ? error.message : 'Nie udało się pobrać opisu gatunku.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailsLoading(false);
      });

    void loadNearby(card, controller.signal).then((next) => {
      if (!controller.signal.aborted) setNearby(next);
    });

    return () => controller.abort();
  }, [card]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable style={styles.back} onPress={onBack} accessibilityRole="button">
        <MaterialCommunityIcons name="arrow-left" size={20} color={colors.text} />
        <Text style={styles.backText}>Atlas</Text>
      </Pressable>

      {card.photoUrl ? (
        <Image source={{ uri: card.photoUrl }} style={styles.photo} resizeMode="cover" />
      ) : (
        <View style={styles.photoPlaceholder}>
          <MaterialCommunityIcons name="mushroom-outline" size={42} color="#7caf8b" />
        </View>
      )}

      <Text style={[styles.badge, badgeStyle(card.category)]}>{card.category === 'unknown' ? 'Jadalność nieustalona' : categoryLabel(card.category)}</Text>
      <Text style={styles.name}>{card.name}</Text>
      <Text style={styles.scientific}>{card.scientificName}</Text>
      <Text style={styles.warning}>Opis jest edukacyjny. Nie jedz grzybów na podstawie atlasu ani zdjęcia.</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Opis</Text>
        <HtmlText html={description} style={styles.body} />
        <Text style={styles.source}>Źródło: {descriptionSource}</Text>
        {detailsLoading ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : null}
        {detailsError ? <Text style={styles.error}>{detailsError}</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gdzie występuje</Text>
        <Text style={styles.body}>{card.habitat}</Text>
        {range ? <HtmlText html={range} style={styles.body} /> : null}
        {places.length ? (
          <Text style={styles.body}>Ostatnie zgłoszenia na iNaturalist: {places.map((place) => <Text key={place}>{`\n • ${place}`}</Text>)}</Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Podobne gatunki</Text>
        {similar.length === 0 ? (
          <Text style={styles.body}>Brak podobnych gatunków w katalogu.</Text>
        ) : similar.map((candidate) => (
          <Pressable key={candidate.key} style={styles.similarRow} onPress={() => onOpen(candidate)} accessibilityRole="button">
            <View style={styles.similarCopy}>
              <Text style={styles.similarName}>{candidate.name}</Text>
              <Text style={styles.similarScientific}>{candidate.scientificName}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
          </Pressable>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>W Twojej okolicy</Text>
        <Text style={styles.body}>{nearbyMessage(nearby)}</Text>
      </View>
    </ScrollView>
  );
}

function localSimilar(card: AtlasCard): AtlasCard[] {
  const genus = card.scientificName.split(' ')[0]?.toLowerCase();
  if (!genus) return [];
  return MUSHROOM_ATLAS
    .filter((species) => species.scientificName.toLowerCase() !== card.scientificName.toLowerCase())
    .filter((species) => species.scientificName.toLowerCase().startsWith(`${genus} `))
    .map((species) => toCard(species));
}

async function loadDetails(card: AtlasCard, signal: AbortSignal) {
  const profile = await fetchTaxonProfile(card.scientificName, card.taxonId, signal);
  if (!profile) return null;

  const [extract, places, similarTaxa] = await Promise.all([
    profile.wikipediaUrl ? fetchPolishWikipediaExtract(profile.wikipediaUrl, signal).catch(() => null) : Promise.resolve(null),
    fetchRecentPlaces(profile.id, signal).catch(() => [] as string[]),
    profile.genusId ? fetchSimilarTaxa(profile.genusId, profile.id, signal).catch(() => []) : Promise.resolve([]),
  ]);

  const description = extract || profile.summary || null;
  const summary = profile.summary?.trim() ?? '';
  const range = extract && summary && !extract.includes(summary) ? summary : null;
  return {
    description,
    descriptionSource: extract ? 'Wikipedia' : profile.summary ? 'iNaturalist' : card.local ? 'Katalog Forest Sense' : 'iNaturalist',
    range,
    places,
    similar: similarTaxa.map(remoteCard),
  };
}

async function loadNearby(card: AtlasCard, signal: AbortSignal): Promise<NearbyState> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { status: 'denied' };
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    if (signal.aborted) return { status: 'loading' };
    const profile = await fetchTaxonProfile(card.scientificName, card.taxonId, signal);
    if (!profile) return { status: 'error' };
    const count = await fetchNearbyObservationCount(
      profile.id,
      position.coords.latitude,
      position.coords.longitude,
      NEARBY_RADIUS_KM,
      signal,
    );
    return count > 0 ? { status: 'found', count } : { status: 'absent' };
  } catch {
    return { status: 'error' };
  }
}

function badgeStyle(category: AtlasCard['category']) {
  if (category === 'poisonous') return styles.badgePoisonous;
  if (category === 'inedible') return styles.badgeInedible;
  if (category === 'unknown') return styles.badgeUnknown;
  return styles.badgeEdible;
}

function nearbyMessage(nearby: NearbyState): string {
  if (nearby.status === 'loading') return `Sprawdzam obserwacje w promieniu ${NEARBY_RADIUS_KM} km…`;
  if (nearby.status === 'denied') return 'Włącz lokalizację, żeby sprawdzić, czy gatunek był zgłaszany w okolicy.';
  if (nearby.status === 'error') return 'Nie udało się sprawdzić obserwacji w okolicy.';
  if (nearby.status === 'absent') return `W promieniu ${NEARBY_RADIUS_KM} km nie ma obserwacji tego gatunku na iNaturalist.`;
  const count = nearby.count.toLocaleString('pl-PL');
  return `W promieniu ${NEARBY_RADIUS_KM} km iNaturalist ma ${count} obserwacji. To zgłoszenia ludzi, nie pewność, że grzyb rośnie tu teraz.`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 36 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  photo: { width: '100%', height: 220, borderRadius: 18, backgroundColor: '#0c2018', marginBottom: 16 },
  photoPlaceholder: { height: 140, borderRadius: 18, backgroundColor: '#0d2119', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  badge: { alignSelf: 'flex-start', overflow: 'hidden', fontSize: 11, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  badgeEdible: { backgroundColor: '#17462f', color: '#aff0b8' },
  badgePoisonous: { backgroundColor: '#512628', color: '#ffc1b5' },
  badgeInedible: { backgroundColor: '#4a3c20', color: '#f5d98f' },
  badgeUnknown: { backgroundColor: '#293a32', color: '#bfd4c6' },
  name: { color: colors.text, fontSize: 28, fontWeight: '800', marginTop: 10 },
  scientific: { color: colors.muted, fontSize: 14, fontStyle: 'italic', marginTop: 4 },
  warning: { color: colors.warningText, fontSize: 12, lineHeight: 18, marginTop: 12 },
  section: { marginTop: 22 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  body: { color: '#d3e5d9', fontSize: 14, lineHeight: 22, marginBottom: 8 },
  source: { color: '#829e8e', fontSize: 11 },
  loader: { marginTop: 10, alignSelf: 'flex-start' },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18, marginTop: 8 },
  similarRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8 },
  similarCopy: { flex: 1 },
  similarName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  similarScientific: { color: colors.muted, fontSize: 12, fontStyle: 'italic', marginTop: 2 },
});
