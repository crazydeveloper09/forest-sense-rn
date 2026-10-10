import { lazy, Suspense, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { getUsage, subscribeUsage, type UsageStatus } from '../billing';
import SuitabilityLegend from '../components/weather-map/SuitabilityLegend';
import SuitabilityMap from '../components/weather-map/SuitabilityMap';
import SuitabilityPanel from '../components/weather-map/SuitabilityPanel';
import WeatherConditionsPanel from '../components/weather-map/WeatherConditionsPanel';
import { getOfflineObservations, subscribeOfflineObservations } from '../storage';
import { useWeatherMap } from './weather-map/useWeatherMap';

const NativeBannerAd = lazy(() => import('../components/NativeBannerAd'));
const BANNER_AD_UNIT_ID = __DEV__
  ? Platform.OS === 'ios'
    ? 'ca-app-pub-3940256099942544/2934735716'
    : 'ca-app-pub-3940256099942544/6300978111'
  : process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID;

type Props = { adsEnabled: boolean; isPremium: boolean };

export default function WeatherMapScreen({ adsEnabled, isPremium }: Props) {
  const { user } = useAuth();
  const [usage, setUsage] = useState<UsageStatus | null>(null);
  const [historyPins, setHistoryPins] = useState<Array<{ latitude: number; longitude: number; name: string; probability: number }>>([]);
  const {
    mapRef,
    location,
    suitability,
    modelLoading,
    modelError,
    weather,
    weatherLoading,
    weatherError,
    summary,
    premiumInsight,
    potentialSpecies,
    refreshCurrentViewport,
    handleRegionChangeComplete,
  } = useWeatherMap(isPremium);

  useEffect(() => {
    let isMounted = true;
    getUsage().then((status) => {
      if (isMounted) setUsage(status);
    }).catch(() => {});
    const unsubscribe = subscribeUsage((status) => {
      if (isMounted) setUsage(status);
    });
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isPremium) {
      setHistoryPins([]);
      return;
    }

    const loadPins = () => {
      const observations = getOfflineObservations(user?.id)
        .filter((item) => item.latitude != null && item.longitude != null)
        .map((item) => ({
          latitude: item.latitude ?? 0,
          longitude: item.longitude ?? 0,
          name: item.name,
          probability: item.probability,
        }));
      setHistoryPins(observations);
    };
    loadPins();
    return subscribeOfflineObservations(loadPins);
  }, [isPremium, user?.id]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Mapa i warunki</Text>
      {adsEnabled && usage?.plan === 'free' && BANNER_AD_UNIT_ID ? (
        <View style={styles.bannerContainer}>
          <Suspense fallback={null}><NativeBannerAd unitId={BANNER_AD_UNIT_ID} /></Suspense>
        </View>
      ) : null}
      <WeatherConditionsPanel
        weather={weather}
        weatherLoading={weatherLoading}
        weatherError={weatherError}
        suitability={suitability}
        isPremium={isPremium}
        premiumInsight={premiumInsight}
        onRefresh={refreshCurrentViewport}
        disabled={weatherLoading || modelLoading}
      />
      <SuitabilityMap
        mapRef={mapRef}
        cells={suitability?.cells ?? []}
        location={location}
        historyPins={historyPins}
        isPremium={isPremium}
        onRegionChangeComplete={handleRegionChangeComplete}
      />
      <SuitabilityLegend />
      <SuitabilityPanel
        summary={summary}
        potentialSpecies={potentialSpecies}
        suitability={suitability}
        isPremium={isPremium}
        premiumInsight={premiumInsight}
        loading={modelLoading}
        error={modelError}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#081a14' },
  content: { padding: 20, paddingTop: 30, paddingBottom: 36 },
  title: { color: '#edf9f1', fontSize: 28, fontWeight: '800', marginBottom: 16 },
  bannerContainer: { alignItems: 'center', justifyContent: 'center', minHeight: 54, marginBottom: 12, overflow: 'hidden' },
});
