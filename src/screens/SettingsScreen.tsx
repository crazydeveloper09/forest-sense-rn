import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import SettingsAccountCard from '../components/settings/SettingsAccountCard';
import SettingsPlanCard from '../components/settings/SettingsPlanCard';
import SettingsSupportCard from '../components/settings/SettingsSupportCard';
import { useSyncStatus } from '../sync/observations';
import PremiumScreen from './PremiumScreen';
import PrivacyPolicyScreen from './PrivacyPolicyScreen';
import { colors } from '../theme';

const appPackage = require('../../package.json') as { version?: string };
const APP_VERSION = appPackage.version ?? 'unknown';

export default function SettingsScreen() {
  const { user, openAuth, logout } = useAuth();
  const sync = useSyncStatus();
  const [showPremium, setShowPremium] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  const syncLabel = !user
    ? 'Zaloguj się, aby synchronizować obserwacje, limity i Premium.'
    : sync.status === 'syncing'
      ? 'Synchronizowanie konta…'
      : sync.status === 'offline'
        ? 'Brak internetu. Synchronizacja wznowi się automatycznie.'
        : sync.status === 'error'
          ? sync.lastError ?? 'Synchronizacja nie powiodła się.'
          : sync.lastSyncedAt
            ? `Ostatnia synchronizacja: ${new Date(sync.lastSyncedAt).toLocaleString('pl-PL')}`
            : 'Konto zsynchronizuje się po połączeniu z internetem, a potem co 15 minut.';

  if (showPrivacyPolicy) {
    return <PrivacyPolicyScreen onBack={() => setShowPrivacyPolicy(false)} />;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Ustawienia</Text>
      <SettingsAccountCard
        loggedIn={Boolean(user)}
        displayName={user?.displayName ?? ''}
        email={user?.email ?? ''}
        syncLabel={syncLabel}
        onLogin={openAuth}
        onLogout={() => void logout()}
      />
      <SettingsPlanCard expanded={showPremium} onToggle={() => setShowPremium((current) => !current)} />
      {showPremium && (
        <View style={styles.inlinePremiumWrapper}>
          <PremiumScreen />
        </View>
      )}
      <SettingsSupportCard onPrivacyPolicy={() => setShowPrivacyPolicy(true)} />
      <View style={styles.versionCard}>
        <Text style={styles.versionText}>Wersja: {APP_VERSION}</Text>
        <Text style={styles.authorText}>Stworzone przez Maciej Solutions</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 20, paddingBottom: 36 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', marginBottom: 8 },
  inlinePremiumWrapper: { marginBottom: 16 },
  versionCard: {
    backgroundColor: '#0b1f1a',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1d3d34',
    padding: 16,
    alignItems: 'center',
  },
  versionText: { color: '#edf9f1', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  authorText: { color: '#9ec0ae', fontSize: 14, fontWeight: '800' },
});
