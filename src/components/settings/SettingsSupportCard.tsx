import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

const SUPPORT_EMAIL = 'forest.sense@maciejsolutions.pl';

async function openMail(subject: string, body: string) {
  const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  await WebBrowser.openBrowserAsync(url);
}

type Props = {
  onPrivacyPolicy: () => void;
};

export default function SettingsSupportCard({ onPrivacyPolicy }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>Wsparcie</Text>
      <Pressable style={styles.menuButton} onPress={() => void openMail('Zgłoszenie uwagi – Forest Sense', 'Opisz problem, który zauważyłeś w aplikacji:\n\n')}>
        <Text style={styles.menuButtonText}>Zgłoś uwagę</Text>
        <Text style={styles.menuButtonIcon}>›</Text>
      </Pressable>
      <Pressable style={styles.menuButton} onPress={() => void openMail('Pomysł na ulepszenie – Forest Sense', 'Napisz, co warto poprawić lub dodać w aplikacji:\n\n')}>
        <Text style={styles.menuButtonText}>Pomysł na ulepszenie</Text>
        <Text style={styles.menuButtonIcon}>›</Text>
      </Pressable>
      <Pressable style={styles.menuButton} onPress={onPrivacyPolicy}>
        <Text style={styles.menuButtonText}>Polityka prywatności</Text>
        <Text style={styles.menuButtonIcon}>›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0f251d',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1d3d34',
    padding: 18,
    marginBottom: 16,
  },
  cardLabel: {
    color: '#9ec0ae',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  menuButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#102a21',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1b3e34',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 10,
  },
  menuButtonText: { color: '#f3faf4', fontWeight: '700', fontSize: 14 },
  menuButtonIcon: { color: '#b9e7c2', fontSize: 22, fontWeight: '700' },
});
