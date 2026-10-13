import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, StatusBar as NativeStatusBar, StyleSheet, View } from 'react-native';
import { initializeGoogleMobileAds } from './src/ads';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import BottomTabs, { type TabKey } from './src/components/BottomTabsBar';
import { getUsage, subscribeUsage } from './src/billing';
import AIRecognitionScreen from './src/screens/AIRecognitionScreen';
import AtlasScreen from './src/screens/AtlasScreen';
import AuthScreen from './src/screens/AuthScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import MapScreen from './src/screens/MapScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import WeatherMapScreen from './src/screens/WeatherMapScreen';
import { initializeAppStorage } from './src/storage';
import { startAutoSync } from './src/sync/observations';

const androidStatusBarInset = Platform.OS === 'android' ? NativeStatusBar.currentHeight ?? 0 : 0;

function App() {
  const { user, authVisible } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('map');
  const [adsAllowed, setAdsAllowed] = useState(false);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    initializeAppStorage();
    void initializeGoogleMobileAds().then(setAdsAllowed);
  }, []);

  useEffect(() => subscribeUsage((usage) => setIsPremium(usage.plan === 'premium')), []);

  useEffect(() => {
    let mounted = true;
    void getUsage()
      .then((usage) => {
        if (mounted) setIsPremium(usage.plan === 'premium');
      })
      .catch(() => {
        if (mounted) setIsPremium(false);
      });
    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !isPremium) return;
    return startAutoSync();
  }, [user, isPremium]);

  const renderScreen = () => {
    switch (activeTab) {
      case 'map':
        return <WeatherMapScreen adsEnabled={adsAllowed} isPremium={isPremium} />;
      case 'ai':
        return <AIRecognitionScreen adsEnabled={adsAllowed} isPremium={isPremium} />;
      case 'atlas':
        return <AtlasScreen />;
      case 'history':
        return <HistoryScreen isPremium={isPremium} />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return <MapScreen />;
    }
  };

  return (
    <View style={styles.appShell}>
      <StatusBar style="light" />
      <View style={[styles.screen, { paddingTop: androidStatusBarInset }]}>{renderScreen()}</View>
      <BottomTabs activeTab={activeTab} onChange={setActiveTab} />
      {authVisible && (
        <View style={[styles.authOverlay, { paddingTop: androidStatusBarInset }]}>
          <AuthScreen />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: '#071b15',
  },
  screen: {
    flex: 1,
    backgroundColor: '#081a14',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#081a14',
  },
  placeholderTitle: {
    color: '#edf9f0',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12,
  },
  placeholderText: {
    color: '#bfd9c9',
    fontSize: 15,
    lineHeight: 22,
  },
  authOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#081a14',
  },
});

export default function Root() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}
