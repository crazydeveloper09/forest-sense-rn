import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TRAIT_QUESTIONS, type TraitChoice } from '../../ai/traits';
import { colors } from '../../theme';

type Props = {
  step: number;
  onAnswer: (choice: TraitChoice) => void;
  onCancel: () => void;
};

export default function RecognitionQuiz({ step, onAnswer, onCancel }: Props) {
  const question = TRAIT_QUESTIONS[step];
  if (!question) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.progress}>Pytanie {step + 1} z {TRAIT_QUESTIONS.length}</Text>
      <Text style={styles.prompt}>{question.prompt}</Text>
      {question.options.map((option) => (
        <Pressable key={option.id} style={styles.option} onPress={() => onAnswer(option.id)}>
          <Text style={styles.letter}>{option.id}</Text>
          <Text style={styles.label}>{option.label}</Text>
        </Pressable>
      ))}
      <Pressable onPress={onCancel} style={styles.cancel}>
        <Text style={styles.cancelText}>Anuluj i wybierz inne zdjęcie</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  progress: { color: colors.muted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  prompt: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.inset,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  letter: { color: colors.accent, fontWeight: '800', width: 18 },
  label: { color: colors.text, flex: 1, fontWeight: '700' },
  cancel: { alignSelf: 'flex-start', marginTop: 4, paddingVertical: 6 },
  cancelText: { color: colors.muted, fontWeight: '700' },
});
