import { StyleSheet, Text } from 'react-native';

export default function RecognitionSafetyNotice() {
  return (
    <Text style={styles.notice}>
      AI może się pomylić. Nie jedz grzyba na podstawie wyniku aplikacji. Weryfikuj go z ekspertem — pomyłka może być śmiertelnie niebezpieczna.
    </Text>
  );
}

const styles = StyleSheet.create({
  notice: { color: '#ffd0a6', backgroundColor: '#35251a', borderColor: '#68452c', borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 14, fontSize: 12, lineHeight: 18 },
});
