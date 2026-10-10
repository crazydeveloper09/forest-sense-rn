import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { remoteCard, toCard } from '../atlas/cards';
import AtlasSpeciesCard from '../components/atlas/AtlasSpeciesCard';
import AtlasToolbar from '../components/atlas/AtlasToolbar';
import { fetchFungiCatalog, searchFungi, type INaturalistTaxon } from '../inat';
import { MUSHROOM_ATLAS, type EdibilityCategory } from '../mushroomAtlas';

type Filter = 'all' | EdibilityCategory;

export default function AtlasScreen() {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [remoteTaxa, setRemoteTaxa] = useState<INaturalistTaxon[]>([]);
  const [catalogTaxa, setCatalogTaxa] = useState<INaturalistTaxon[]>([]);
  const [catalogPage, setCatalogPage] = useState(0);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setCatalogLoading(true);
    fetchFungiCatalog(1, controller.signal)
      .then(({ taxa, totalResults }) => {
        setCatalogTaxa(taxa);
        setCatalogPage(1);
        setCatalogTotal(totalResults);
        setCatalogError(null);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setCatalogError(error instanceof Error ? error.message : 'Nie udało się pobrać zdjęć z iNaturalist.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCatalogLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setRemoteTaxa([]);
      setApiError(null);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setApiError(null);
      try {
        setRemoteTaxa(await searchFungi(trimmed, controller.signal));
      } catch (error) {
        if (!controller.signal.aborted) {
          setApiError(error instanceof Error ? error.message : 'Nie udało się połączyć z katalogiem iNaturalist.');
          setRemoteTaxa([]);
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 450);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const loadMoreCatalog = async () => {
    if (catalogLoading || catalogPage === 0 || catalogPage * 50 >= catalogTotal) return;
    const nextPage = catalogPage + 1;
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const next = await fetchFungiCatalog(nextPage);
      setCatalogTaxa((current) => {
        const knownIds = new Set(current.map((taxon) => taxon.id));
        return [...current, ...next.taxa.filter((taxon) => !knownIds.has(taxon.id))];
      });
      setCatalogPage(nextPage);
      setCatalogTotal(next.totalResults);
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : 'Nie udało się pobrać kolejnej strony atlasu.');
    } finally {
      setCatalogLoading(false);
    }
  };

  const cards = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pl-PL');
    const displayedTaxa = normalizedQuery.length >= 2 ? remoteTaxa : catalogTaxa;
    const taxaByScientificName = new Map(displayedTaxa.map((taxon) => [taxon.name.toLowerCase(), taxon]));
    const localCards = MUSHROOM_ATLAS
      .filter((species) => filter === 'all' || species.category === filter)
      .filter((species) => !normalizedQuery || `${species.polishName} ${species.scientificName}`.toLocaleLowerCase('pl-PL').includes(normalizedQuery))
      .map((species) => toCard(species, taxaByScientificName.get(species.scientificName.toLowerCase())));

    const remoteCards = displayedTaxa
      .map(remoteCard)
      .filter((card) => filter === 'all' || card.category === filter);
    const knownNames = new Set(localCards.map((card) => card.scientificName.toLowerCase()));
    return [...localCards, ...remoteCards.filter((card) => !knownNames.has(card.scientificName.toLowerCase()))];
  }, [catalogTaxa, filter, query, remoteTaxa]);

  const hasMoreCatalog = query.trim().length < 2 && catalogPage > 0 && catalogPage * 50 < catalogTotal;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Atlas grzybów</Text>
          <Text style={styles.subtitle}>Poznaj gatunki i ich cechy</Text>
        </View>
        <MaterialCommunityIcons name="book-open-page-variant" size={30} color="#aef0a0" />
      </View>

      <View style={styles.warningCard}>
        <MaterialCommunityIcons name="alert-octagon-outline" size={23} color="#ffc078" />
        <Text style={styles.warningText}>Kategorie są edukacyjne, nie potwierdzają bezpieczeństwa okazu. Nie jedz grzybów na podstawie atlasu ani zdjęcia — identyfikację powierz ekspertowi.</Text>
      </View>

      <AtlasToolbar query={query} filter={filter} searching={searching} onQueryChange={setQuery} onFilterChange={setFilter} />

      <Text style={styles.resultCount}>
        {query.trim().length >= 2
          ? `Wyniki iNaturalist i katalogu offline · ${cards.length}`
          : catalogPage > 0
            ? `Atlas offline + ${catalogTaxa.length} gatunków ze zdjęciami · ${cards.length} wyświetlanych`
            : `Katalog offline · ${cards.length} gatunków`}
      </Text>
      {apiError && <Text style={styles.apiError}>{apiError} Pokazuję wyniki zapisane offline.</Text>}
      {catalogError && <Text style={styles.apiError}>{catalogError} Możesz korzystać z katalogu offline.</Text>}

      {cards.length === 0 ? (
        <View style={styles.emptyCard}>
          <MaterialCommunityIcons name="mushroom-outline" size={36} color="#78a78a" />
          <Text style={styles.emptyTitle}>Brak wyników</Text>
          <Text style={styles.emptyDescription}>Spróbuj innej nazwy lub wybierz filtr „Wszystkie”.</Text>
        </View>
      ) : cards.map((card) => <AtlasSpeciesCard key={card.key} card={card} />)}
      {hasMoreCatalog && (
        <Pressable style={styles.loadMoreButton} onPress={loadMoreCatalog} disabled={catalogLoading}>
          {catalogLoading ? <ActivityIndicator color="#aef0a0" /> : <Text style={styles.loadMoreText}>Pokaż kolejne 50 gatunków</Text>}
        </Pressable>
      )}
      {catalogLoading && catalogPage === 0 ? <ActivityIndicator style={styles.initialLoader} color="#aef0a0" /> : null}
      <Text style={styles.footer}>Nazwy i ilustracje z iNaturalist zależą od dostępności API. Informacja o jadalności jest przypisana tylko dla gatunków z lokalnego katalogu i nie zastępuje weryfikacji eksperta.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#081a14' },
  content: { padding: 20, paddingTop: 30, paddingBottom: 36 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 17 },
  headerText: { flex: 1 },
  title: { color: '#edf9f1', fontSize: 28, fontWeight: '800' },
  subtitle: { color: '#9dbfaa', fontSize: 13, marginTop: 4 },
  warningCard: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: '#35271a', borderColor: '#67492c', borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 14 },
  warningText: { flex: 1, color: '#ffddb0', fontSize: 12, lineHeight: 18 },
  resultCount: { color: '#94b5a1', fontSize: 12, marginBottom: 10 },
  apiError: { color: '#ffb7a7', fontSize: 12, lineHeight: 18, marginBottom: 10 },
  loadMoreButton: { alignItems: 'center', justifyContent: 'center', minHeight: 46, borderRadius: 13, borderColor: '#3b7656', borderWidth: 1, backgroundColor: '#143a2a', marginBottom: 14 },
  loadMoreText: { color: '#c3f0c6', fontSize: 13, fontWeight: '800' },
  initialLoader: { marginVertical: 20 },
  emptyCard: { alignItems: 'center', backgroundColor: '#10271e', borderRadius: 18, padding: 26 },
  emptyTitle: { color: '#eff8f1', fontSize: 17, fontWeight: '800', marginTop: 8 },
  emptyDescription: { color: '#9dbfaa', fontSize: 12, textAlign: 'center', marginTop: 5 },
  footer: { color: '#789381', fontSize: 10, lineHeight: 15, marginTop: 4 },
});
