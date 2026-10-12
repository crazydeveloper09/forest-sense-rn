import { StyleSheet, Text } from 'react-native';
import { colors } from '../../theme';

export default function RecognitionSafetyNotice() {
  return (
    <Text style={styles.notice}>Wynik nie zastępuje eksperta. Nie jedz na podstawie zdjęcia.</Text>
  );
}

const styles = StyleSheet.create({
  notice: { color: colors.warningText, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
