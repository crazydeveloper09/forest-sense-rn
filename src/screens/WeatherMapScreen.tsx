import { lazy, Suspense, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { getUsage, subscribeUsage, type UsageStatus } from '../billing';
import SuitabilityLegend from '../components/weather-map/SuitabilityLegend';
import SuitabilityMap from '../components/weather-map/SuitabilityMap';
import SuitabilityPanel from '../components/weather-map/SuitabilityPanel';
import WeatherConditionsPanel from '../components/weather-map/WeatherConditionsPanel';
import { getOfflineObservations, subscribeOfflineObservations } from '../storage';
import { colors } from '../theme';
import { useWeatherMap } from './weather-map/useWeatherMap';

const iosOverlayInset = Platform.OS === 'ios' ? (Constants.statusBarHeight || 47) : 0;
const NativeBannerAd = lazy(() => import('../components/NativeBannerAd'));
const BANNER_AD_UNIT_ID = __DEV__
  ? Platform.OS === 'ios'
    ? 'ca-app-pub-3940256099942544/2934735716'
    : 'ca-app-pub-3940256099942544/6300978111'
  : process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID;

type Props = { adsEnabled: boolean; isPremium: boolean };

function conditionLabel(score: number | null) {
  if (score == null) return 'Warunki';
  if (score >= 70) return 'Dobre warunki';
  if (score >= 45) return 'Umiarkowane';
  return 'Słabe warunki';
}

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
    handleRegionChange,
    handleRegionChangeComplete,
    handleMapReady,
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

  const score = summary?.score ?? null;
  const refreshing = weatherLoading || modelLoading;

  return (
    <View style={styles.screen}>
      <View style={styles.mapStage}>
        <SuitabilityMap
          mapRef={mapRef}
          cells={suitability?.cells ?? []}
          location={location}
          historyPins={historyPins}
          isPremium={isPremium}
          onRegionChange={handleRegionChange}
          onRegionChangeComplete={handleRegionChangeComplete}
          onMapReady={handleMapReady}
        />
        <View style={[styles.overlay, { top: 12 + iosOverlayInset }]} pointerEvents="box-none">
          <View>
            <Text style={styles.chip}>{conditionLabel(score)}</Text>
            <Text style={styles.score}>{score ?? '—'}</Text>
            <Text style={styles.overlayMeta}>
              {weather ? `${Math.round(weather.temperature)}° · ${weather.humidity}%` : 'Pogoda…'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Odśwież warunki"
            style={[styles.refresh, Platform.OS === 'ios' && styles.refreshBelowCompass, refreshing && styles.refreshDisabled]}
            onPress={refreshCurrentViewport}
            disabled={refreshing}
          >
            <MaterialCommunityIcons name="refresh" size={22} color={colors.text} />
          </Pressable>
        </View>
      </View>
      {adsEnabled && usage?.plan === 'free' && BANNER_AD_UNIT_ID ? (
        <View style={styles.bannerContainer}>
          <Suspense fallback={null}><NativeBannerAd unitId={BANNER_AD_UNIT_ID} /></Suspense>
        </View>
      ) : null}
      <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetContent}>
        <WeatherConditionsPanel
          weather={weather}
          weatherLoading={weatherLoading}
          weatherError={weatherError}
          suitability={suitability}
          isPremium={isPremium}
          premiumInsight={premiumInsight}
          onRefresh={refreshCurrentViewport}
          disabled={refreshing}
          score={score}
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  mapStage: { flex: 1.15, minHeight: 240 },
  overlay: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  chip: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    backgroundColor: colors.button,
    color: colors.buttonText,
    fontSize: 12,
    fontWeight: '800',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  score: { color: '#ffffff', fontSize: 52, fontWeight: '800', lineHeight: 58, marginTop: 6, textShadowColor: 'rgba(8, 26, 20, 0.65)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  overlayMeta: { color: '#ffffff', fontSize: 15, fontWeight: '700', textShadowColor: 'rgba(8, 26, 20, 0.65)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  refreshBelowCompass: { marginTop: 56 },
  refresh: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sheet,
    borderWidth: 1,
    borderColor: colors.border,
    opacity: 1,
  },
  refreshDisabled: { opacity: 0.5 },
  bannerContainer: { alignItems: 'center', justifyContent: 'center', minHeight: 54, backgroundColor: colors.background, overflow: 'hidden' },
  sheet: { flex: 0.95, backgroundColor: colors.sheet, borderTopWidth: 1, borderTopColor: colors.border },
  sheetContent: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24 },
});
