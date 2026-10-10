import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';

type Props = {
  onBack: () => void;
};

export default function PrivacyPolicyScreen({ onBack }: Props) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>← Wróć</Text>
      </Pressable>

      <View style={styles.headerCard}>
        <Text style={styles.eyebrow}>Prawo i prywatność</Text>
        <Text style={styles.title}>Polityka prywatności</Text>
        <Text style={styles.subtitle}>Szablon do uzupełnienia przez właściciela aplikacji.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>1. Informacje ogólne</Text>
        <Text style={styles.text}>
          Niniejsza polityka prywatności określa zasady przetwarzania danych osobowych użytkowników aplikacji Forest Sense, w tym danych
          podawanych podczas korzystania z funkcji rozpoznawania grzybów, map, historii obserwacji oraz subskrypcji Premium.
        </Text>
        <Text style={styles.text}>
          Administrator danych osobowych: [Nazwa firmy / imię i nazwisko]. Kontakt: [e-mail], [telefon], [adres].
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>2. Rodzaje danych</Text>
        <Text style={styles.text}>
          Aplikacja może zbierać dane niezbędne do świadczenia usług, w tym: dane techniczne urządzenia, identyfikator instalacji,
          informacje o konfiguracji aplikacji, dane lokalizacji w celach związanych z funkcją mapy oraz dane wprowadzane przez użytkownika
          w ramach obserwacji i rozpoznania grzybów.
        </Text>
        <Text style={styles.text}>
          W przypadku użytkowników Premium mogą być przetwarzane również dane związane z subskrypcją, dostępem do funkcji premium
          i obsługą płatności przez zewnętrznego dostawcę usług płatniczych.
        </Text>
        <Text style={styles.text}>
          Adres e-mail, nazwa i treść obserwacji są szyfrowane na urządzeniu algorytmem AES-256-GCM, zanim trafią do bazy.
          Klucz powstaje z hasła użytkownika i nie jest przechowywany na serwerze. Sekret weryfikacji dwuetapowej jest dodatkowo
          szyfrowany na serwerze, ponieważ serwer musi potwierdzić kod.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>3. Cel przetwarzania</Text>
        <Text style={styles.text}>
          Dane są przetwarzane w celu zapewnienia funkcjonalności aplikacji, poprawy jakości usług, analizy użytkowania, obsługi
          reklam i wsparcia technicznego, a także w celu realizacji umowy lub świadczenia usług na podstawie wyraźnie określonego celu.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>4. Podstawa prawna</Text>
        <Text style={styles.text}>
          Przetwarzanie danych odbywa się na podstawie: zgodności z umową (np. świadczenie usług w aplikacji), uzasadnionego interesu
          administratora, obowiązków prawnych oraz – tam, gdzie wymagają tego przepisy – dobrowolnej zgody użytkownika.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>5. Prawa użytkownika</Text>
        <Text style={styles.text}>
          Użytkownik ma prawo do dostępu do swoich danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia danych
          oraz wniesienia sprzeciwu wobec przetwarzania. W przypadku pytań lub wniosków użytkownik może skontaktować się z administratorem
          pod adresem: [e-mail].
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>6. Pliki cookies i dane techniczne</Text>
        <Text style={styles.text}>
          Aplikacja może wykorzystywać technologię identyfikacji urządzenia, dane o sesji i metadane potrzebne do zapewnienia
          stabilności działania oraz obsługi reklam lub analiz. W przypadku korzystania z usług zewnętrznych, ich polityki prywatności
          określają dodatkowe zasady przetwarzania danych.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>7. Okres przechowywania</Text>
        <Text style={styles.text}>
          Dane są przechowywane przez okres nie dłuższy niż jest to konieczne do realizacji celu, do którego zostały zebrane, lub przez
          okres wymagany przez przepisy prawa. Po upływie okresu dane są usuwane lub anonimizowane.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>8. Kontakt i aktualizacje</Text>
        <Text style={styles.text}>
          Wszelkie pytania dotyczące polityki prywatności można kierować do administratora danych. Polityka może być aktualizowana,
          a jej najnowsza wersja jest dostępna w aplikacji.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#081a14',
  },
  content: {
    padding: 20,
    paddingTop: 28,
    paddingBottom: 36,
  },
  headerCard: {
    backgroundColor: '#0f251d',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#1d3d34',
    padding: 18,
    marginBottom: 18,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#102d24',
    borderWidth: 1,
    borderColor: '#1d4338',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  backButtonText: {
    color: '#f3faf4',
    fontWeight: '700',
  },
  eyebrow: {
    color: '#9ec0ae',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  title: {
    color: '#edf9f1',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#dfeae3',
    fontSize: 14,
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#0f251d',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1d3d34',
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#f3faf4',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },
  text: {
    color: '#dfeae3',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 10,
  },
});
