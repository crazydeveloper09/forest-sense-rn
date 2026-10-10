import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { EdibilityCategory } from '../../mushroomAtlas';

type Filter = 'all' | EdibilityCategory;

const filters = [
  ['all', 'Wszystkie'],
  ['edible', 'Jadalne'],
  ['poisonous', 'Trujące'],
  ['inedible', 'Niejadalne'],
] as const;

type Props = {
  query: string;
  filter: Filter;
  searching: boolean;
  onQueryChange: (value: string) => void;
  onFilterChange: (filter: Filter) => void;
};

export default function AtlasToolbar({ query, filter, searching, onQueryChange, onFilterChange }: Props) {
  return (
    <>
      <View style={styles.searchBox}>
        <MaterialCommunityIcons name="magnify" size={21} color="#8eaf9c" />
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder="Szukaj nazwy polskiej lub łacińskiej"
          placeholderTextColor="#779583"
          style={styles.searchInput}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Szukaj w atlasie grzybów"
        />
        {searching ? <ActivityIndicator color="#aef0a0" /> : query.length > 0 ? (
          <Pressable onPress={() => onQueryChange('')} accessibilityLabel="Wyczyść wyszukiwanie">
            <MaterialCommunityIcons name="close-circle" size={20} color="#8eaf9c" />
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {filters.map(([key, label]) => (
          <Pressable key={key} onPress={() => onFilterChange(key)} style={[styles.filterChip, filter === key && styles.filterChipActive]}>
            <Text style={[styles.filterText, filter === key && styles.filterTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#102d24', borderColor: '#1d4338', borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, minHeight: 48 },
  searchInput: { flex: 1, color: '#f1faf3', paddingVertical: 10, fontSize: 14 },
  filters: { gap: 8, paddingVertical: 14 },
  filterChip: { borderRadius: 999, borderColor: '#285142', borderWidth: 1, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#0d2019' },
  filterChipActive: { backgroundColor: '#246344', borderColor: '#4a9b68' },
  filterText: { color: '#a8c7b5', fontSize: 12, fontWeight: '700' },
  filterTextActive: { color: '#f2fff5' },
});
