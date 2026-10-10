import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  onStart: () => void;
};

const features = [
  'Mapa występowania grzybów w okolicy',
  'Rozpoznawanie grzybów AI na podstawie zdjęcia',
  'Historia obserwacji dostępna offline',
  'Powiadomienia o dobrych warunkach',
];

export default function OnboardingScreen({ onStart }: Props) {
  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>Forest Sense</Text>
        <Text style={styles.title}>Wykrywaj grzyby, zanim znikną z lasu</Text>
        <Text style={styles.subtitle}>
          Śledź warunki, rozpoznawaj gatunki i zapisuj obserwacje offline, gdziekolwiek jesteś.
        </Text>

        <View style={styles.featureList}>
          {features.map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <Text style={styles.check}>✓</Text>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        <Pressable style={styles.button} onPress={onStart}>
          <Text style={styles.buttonText}>Rozpocznij</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#081a14',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  eyebrow: {
    color: '#a4e2ad',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  title: {
    color: '#edf9f1',
    fontSize: 34,
    fontWeight: '900',
    marginBottom: 12,
    lineHeight: 42,
  },
  subtitle: {
    color: '#d7e7df',
    fontSize: 16,
    lineHeight: 26,
    marginBottom: 22,
  },
  featureList: {
    marginBottom: 28,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  check: {
    color: '#8fe49b',
    fontSize: 20,
    fontWeight: '800',
    marginRight: 10,
  },
  featureText: {
    color: '#edf9f1',
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  button: {
    backgroundColor: '#2d8d62',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#f8fff9',
    fontSize: 18,
    fontWeight: '800',
  },
});
