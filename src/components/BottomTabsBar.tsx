import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme';

export type TabKey = 'map' | 'ai' | 'atlas' | 'history' | 'settings';

type Props = {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
};

const tabs: { key: TabKey; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { key: 'map', label: 'Mapa', icon: 'map-outline' },
  { key: 'ai', label: 'AI', icon: 'mushroom-outline' },
  { key: 'atlas', label: 'Atlas', icon: 'book-open-page-variant-outline' },
  { key: 'history', label: 'Historia', icon: 'history' },
  { key: 'settings', label: 'Ustawienia', icon: 'cog-outline' },
];

export default function BottomTabsBar({ activeTab, onChange }: Props) {
  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={[styles.tab, isActive && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
          >
            <MaterialCommunityIcons
              name={tab.icon}
              size={21}
              color={isActive ? colors.accent : '#83a995'}
              style={styles.icon}
            />
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.tabBar,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 5,
    paddingVertical: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 12,
  },
  tabActive: {
    backgroundColor: '#1a3f33',
  },
  icon: {
    marginBottom: 4,
  },
  label: {
    color: '#a2c7b2',
    fontSize: 11,
    fontWeight: '700',
  },
  labelActive: {
    color: colors.accent,
  },
});
