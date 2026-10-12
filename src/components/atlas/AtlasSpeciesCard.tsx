import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { categoryLabel } from '../../mushroomAtlas';
import type { AtlasCard } from '../../atlas/cards';

function CategoryBadge({ category }: { category: AtlasCard['category'] }) {
  const label = category === 'unknown' ? 'Jadalność nieustalona' : categoryLabel(category);
  const style = category === 'edible' ? styles.badgeEdible : category === 'poisonous' ? styles.badgePoisonous : category === 'inedible' ? styles.badgeInedible : styles.badgeUnknown;
  return <Text style={[styles.categoryBadge, style]}>{label}</Text>;
}

export default function AtlasSpeciesCard({ card, onPress }: { card: AtlasCard; onPress?: () => void }) {
  return (
    <Pressable style={styles.speciesCard} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Więcej o ${card.name}`}>
      {card.photoUrl ? (
        <Image source={{ uri: card.photoUrl }} style={styles.speciesImage} resizeMode="cover" />
      ) : (
        <View style={styles.imagePlaceholder}>
          <MaterialCommunityIcons name="mushroom-outline" size={39} color="#7caf8b" />
          <Text style={styles.photoHint}>{card.local ? 'Opis z katalogu Forest Sense' : 'Brak zdjęcia'}</Text>
        </View>
      )}
      <View style={styles.speciesBody}>
        <CategoryBadge category={card.category} />
        <Text style={styles.speciesName}>{card.name}</Text>
        <Text style={styles.scientificName}>{card.scientificName}</Text>
        <Text style={styles.description}>{card.description}</Text>
        <View style={styles.habitatRow}>
          <MaterialCommunityIcons name="pine-tree" size={16} color="#91bd9e" />
          <Text style={styles.habitat}>{card.habitat}</Text>
        </View>
        {card.attribution ? <Text style={styles.attribution}>Zdjęcie: {card.attribution}{card.license ? ` · licencja ${card.license}` : ''} · iNaturalist</Text> : null}
        {!card.local ? <Text style={styles.source}>Dane taksonomiczne: iNaturalist{card.wikipediaUrl ? ' · dostępne hasło encyklopedyczne' : ''}</Text> : null}
        <Text style={styles.more}>Więcej o gatunku</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  speciesCard: { overflow: 'hidden', backgroundColor: '#10271e', borderColor: '#1d4338', borderWidth: 1, borderRadius: 18, marginBottom: 13 },
  speciesImage: { width: '100%', height: 180, backgroundColor: '#0c2018' },
  imagePlaceholder: { height: 106, backgroundColor: '#0d2119', alignItems: 'center', justifyContent: 'center', gap: 5 },
  photoHint: { color: '#819f8d', fontSize: 10 },
  speciesBody: { padding: 15 },
  categoryBadge: { alignSelf: 'flex-start', overflow: 'hidden', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, fontSize: 10, fontWeight: '800', marginBottom: 9 },
  badgeEdible: { backgroundColor: '#17462f', color: '#aff0b8' },
  badgePoisonous: { backgroundColor: '#512628', color: '#ffc1b5' },
  badgeInedible: { backgroundColor: '#4a3c20', color: '#f5d98f' },
  badgeUnknown: { backgroundColor: '#293a32', color: '#bfd4c6' },
  speciesName: { color: '#f2faf3', fontSize: 20, fontWeight: '800' },
  scientificName: { color: '#a5c2b0', fontSize: 12, fontStyle: 'italic', marginTop: 3 },
  description: { color: '#d3e5d9', fontSize: 13, lineHeight: 20, marginTop: 11 },
  habitatRow: { flexDirection: 'row', gap: 7, alignItems: 'center', marginTop: 11 },
  habitat: { flex: 1, color: '#a9c9b5', fontSize: 12 },
  attribution: { color: '#829e8e', fontSize: 9, lineHeight: 14, marginTop: 10 },
  source: { color: '#83ad91', fontSize: 10, marginTop: 5 },
  more: { color: '#aef0a0', fontSize: 12, fontWeight: '800', marginTop: 12 },
});
