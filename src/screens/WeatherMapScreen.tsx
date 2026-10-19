import { lazy, Suspense, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { getUsage, subscribeUsage, type UsageStatus } from '../billing';
import SuitabilityLegend from '../components/weather-map/SuitabilityLegend';
import TripControls from '../components/weather-map/TripControls';
import SuitabilityMap from '../components/weather-map/SuitabilityMap';
import SuitabilityPanel from '../components/weather-map/SuitabilityPanel';
import WeatherConditionsPanel from '../components/weather-map/WeatherConditionsPanel';
import { getActiveTrip, subscribeTrips } from '../db';
import { getOfflineObservations, saveObservation, subscribeOfflineObservations } from '../storage';
import { getLivePeers, subscribeLivePeers, type LivePeer } from '../trips/live';
import { colors } from '../theme';
import type { MapViewport } from '../suitability';
import { useWeatherMap } from './weather-map/useWeatherMap';

const PLACE_LATITUDE_DELTA = 0.02;

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
  const [historyPins, setHistoryPins] = useState<Array<{ latitude: number; longitude: number; name: string; probability: number; notes: string }>>([]);
  const [latitudeDelta, setLatitudeDelta] = useState(0.09);
  const [draftPoint, setDraftPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [placeHintOpen, setPlaceHintOpen] = useState(false);
  const [tripPoints, setTripPoints] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [livePeers, setLivePeers] = useState<LivePeer[]>([]);
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
    handleMapLayout,
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
    const loadTrip = () => setTripPoints(getActiveTrip()?.points ?? []);
    loadTrip();
    return subscribeTrips(loadTrip);
  }, []);

  useEffect(() => subscribeLivePeers(() => setLivePeers(getLivePeers())), []);

  useEffect(() => {
    const loadPins = () => {
      const observations = getOfflineObservations(user?.id)
        .filter((item) => item.latitude != null && item.longitude != null)
        .map((item) => ({
          latitude: item.latitude ?? 0,
          longitude: item.longitude ?? 0,
          name: item.name,
          probability: item.probability,
          notes: item.notes,
        }));
      setHistoryPins(observations);
    };
    loadPins();
    return subscribeOfflineObservations(loadPins);
  }, [user?.id]);

  const canPlaceObservation = latitudeDelta > 0 && latitudeDelta <= PLACE_LATITUDE_DELTA;

  const finishRegionChange = (viewport: MapViewport) => {
    setLatitudeDelta(viewport.latitudeDelta);
    handleRegionChangeComplete(viewport);
  };

  const saveDraft = () => {
    const name = draftName.trim();
    if (!draftPoint) return;
    if (name.length < 2) {
      setDraftError('Podaj nazwę obserwacji.');
      return;
    }
    saveObservation(name, 0, draftNotes.trim() || 'Dodane z mapy.', draftPoint.latitude, draftPoint.longitude);
    setDraftPoint(null);
    setDraftName('');
    setDraftNotes('');
    setDraftError(null);
  };

  const score = summary?.score ?? null;
  const refreshing = weatherLoading || modelLoading;
  const serviceError = weatherError || modelError;
  const refreshLocked = refreshing && !serviceError;

  return (
    <View style={styles.screen}>
      <View style={styles.mapStage}>
        <SuitabilityMap
          mapRef={mapRef}
          cells={suitability?.cells ?? []}
          location={location}
          historyPins={historyPins}
          isPremium={isPremium}
          tripPoints={tripPoints}
          livePeers={livePeers}
          onRegionChange={handleRegionChange}
          onRegionChangeComplete={finishRegionChange}
          onMapLayout={handleMapLayout}
          onMapReady={handleMapReady}
          canPlaceObservation={isPremium && canPlaceObservation}
          onPlaceObservation={(coordinate) => {
            setDraftPoint(coordinate);
            setDraftName('');
            setDraftNotes('');
            setDraftError(null);
          }}
        />
        <View style={[styles.overlay, { top: 12 + iosOverlayInset }]} pointerEvents="box-none">
          <View>
            <Text style={styles.chip}>{conditionLabel(score)}</Text>
            <Text style={styles.score}>{score ?? '—'}</Text>
            <Text style={styles.overlayMeta}>
              {weather ? `${Math.round(weather.temperature)}° · ${weather.humidity}%` : 'Pogoda…'}
            </Text>
          </View>
          <View style={[styles.toolRow, Platform.OS === 'ios' && styles.refreshBelowCompass]}>
            {isPremium && placeHintOpen ? (
              <View style={styles.placeBubble}>
                <Text style={styles.placeHintText}>
                  {canPlaceObservation
                    ? 'Dotknij mapy, aby dodać obserwację.'
                    : 'Przybliż mapę, aby dodać obserwację w wybranym miejscu.'}
                </Text>
              </View>
            ) : null}
            {isPremium ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Jak dodać obserwację"
                style={styles.refresh}
                onPress={() => setPlaceHintOpen((open) => !open)}
              >
                <MaterialCommunityIcons name="information-outline" size={22} color={colors.text} />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Odśwież warunki"
              style={[styles.refresh, refreshLocked && styles.refreshDisabled]}
              onPress={refreshCurrentViewport}
              disabled={refreshLocked}
            >
              <MaterialCommunityIcons name="refresh" size={22} color={colors.text} />
            </Pressable>
          </View>
        </View>
        {isPremium && draftPoint ? (
          <View style={styles.draft}>
            <Text style={styles.draftTitle}>Nowa obserwacja</Text>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Nazwa grzyba"
              placeholderTextColor="#7f9c8d"
              style={styles.draftInput}
            />
            <TextInput
              value={draftNotes}
              onChangeText={setDraftNotes}
              placeholder="Notatka, opcjonalnie"
              placeholderTextColor="#7f9c8d"
              style={styles.draftInput}
            />
            {draftError ? <Text style={styles.draftError}>{draftError}</Text> : null}
            <View style={styles.draftActions}>
              <Pressable style={styles.draftSave} onPress={saveDraft}>
                <Text style={styles.draftSaveText}>Zapisz</Text>
              </Pressable>
              <Pressable onPress={() => setDraftPoint(null)}>
                <Text style={styles.draftCancel}>Anuluj</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        <View style={styles.tripDock} pointerEvents="box-none">
          <TripControls origin={location} />
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
          disabled={refreshLocked}
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
  tripDock: { position: 'absolute', left: 16, right: 16, bottom: 14 },
  toolRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  placeBubble: {
    maxWidth: 168,
    backgroundColor: 'rgba(8, 26, 20, 0.92)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  placeHintText: { color: '#edf9f1', fontSize: 12, fontWeight: '700', lineHeight: 16 },
  draft: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 78,
    backgroundColor: colors.sheet,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8,
  },
  draftTitle: { color: colors.text, fontWeight: '800' },
  draftInput: {
    backgroundColor: colors.inset,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  draftError: { color: colors.danger },
  draftActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  draftSave: { backgroundColor: colors.button, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  draftSaveText: { color: colors.buttonText, fontWeight: '800' },
  draftCancel: { color: colors.muted, fontWeight: '700' },
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
