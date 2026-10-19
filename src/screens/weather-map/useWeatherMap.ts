import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import MapView from 'react-native-maps';
import * as Location from 'expo-location';
import { fetchSuitabilityGrid, type MapViewport, type SuitabilityResult } from '../../suitability';
import { fetchWeatherData, type WeatherData } from '../../weather';

export const DEFAULT_VIEWPORT: MapViewport = {
  latitude: 52.2297,
  longitude: 21.0122,
  latitudeDelta: 0.09,
  longitudeDelta: 0.09,
};

export type SuitabilitySummary = {
  score: number;
  moisture: number | null;
  rainfall: number | null;
  temperature: number | null;
  slope: number | null;
  soilTexture: string | null;
  elevation: number | null;
};

export type PotentialSpecies = {
  name: string;
  habitat: string;
};

export type PremiumInsight = {
  bestWindow: string;
  riskLabel: string;
  microclimate: string;
  hotspots: Array<{ label: string; score: number; habitat: string }>;
};

function mean(values: Array<number | null>): number | null {
  const available = values.filter((value): value is number => value != null);
  return available.length ? available.reduce((sum, value) => sum + value, 0) / available.length : null;
}

function summarizeSuitability(result: SuitabilityResult | null): SuitabilitySummary | null {
  const cells = result?.cells ?? [];
  if (!cells.length) return null;
  return {
    score: Math.round(mean(cells.map((cell) => cell.score)) ?? 0),
    moisture: mean(cells.map((cell) => cell.soilMoisture)),
    rainfall: mean(cells.map((cell) => cell.rainfall72h)),
    temperature: mean(cells.map((cell) => cell.temperature)),
    slope: mean(cells.map((cell) => cell.slope)),
    soilTexture: cells.find((cell) => cell.soilTexture)?.soilTexture ?? null,
    elevation: mean(cells.map((cell) => cell.elevation)),
  };
}

function findPotentialSpecies(summary: SuitabilitySummary | null): PotentialSpecies[] {
  if (!summary) return [];
  const candidates: Array<PotentialSpecies & { eligible: boolean }> = [
    {
      name: 'Borowik szlachetny',
      eligible: summary.score >= 45 && (summary.moisture ?? 0) >= 0.1 && (summary.temperature ?? 0) >= 5 && (summary.temperature ?? 30) <= 24,
      habitat: 'Sprawdź lasy z dębami, bukami, sosnami lub świerkami.',
    },
    {
      name: 'Maślak zwyczajny',
      eligible: summary.score >= 45 && (summary.moisture ?? 0) >= 0.1 && (summary.soilTexture?.includes('piaszczysta') ?? false),
      habitat: 'Możliwy przy sosnach; model nie posiada jeszcze mapy gatunków drzew.',
    },
    {
      name: 'Pieprznik jadalny (kurka)',
      eligible: summary.score >= 55 && (summary.moisture ?? 0) >= 0.12 && (summary.temperature ?? 0) >= 7 && (summary.temperature ?? 30) <= 22,
      habitat: 'Sprawdź starsze lasy mieszane lub iglaste.',
    },
  ];
  return candidates.filter((candidate) => candidate.eligible);
}

function readViewport(region: Partial<MapViewport> | null | undefined): MapViewport | null {
  const latitude = Number(region?.latitude);
  const longitude = Number(region?.longitude);
  const latitudeDelta = Number(region?.latitudeDelta);
  const longitudeDelta = Number(region?.longitudeDelta);
  if (![latitude, longitude, latitudeDelta, longitudeDelta].every(Number.isFinite)) return null;
  if (Math.abs(latitude) > 85 || Math.abs(longitude) > 180) return null;
  if (latitudeDelta <= 0 || longitudeDelta <= 0) return null;
  return { latitude, longitude, latitudeDelta, longitudeDelta };
}

function regionMeaningfullyChanged(previous: MapViewport | null, next: MapViewport) {
  if (!previous) return true;
  if (distanceInKm(previous, next) >= 0.15) return true;
  const latitudeRatio = Math.abs(next.latitudeDelta - previous.latitudeDelta) / Math.max(previous.latitudeDelta, 0.0001);
  const longitudeRatio = Math.abs(next.longitudeDelta - previous.longitudeDelta) / Math.max(previous.longitudeDelta, 0.0001);
  return latitudeRatio >= 0.12 || longitudeRatio >= 0.12;
}

function viewportForPhone(viewport: MapViewport, width: number, height: number): MapViewport {
  if (Platform.OS !== 'ios' || width < 1 || height < 1) return viewport;
  const viewAspect = width / height;
  const longitudeScale = Math.max(Math.cos((viewport.latitude * Math.PI) / 180), 0.2);
  const regionAspect = (viewport.longitudeDelta * longitudeScale) / Math.max(viewport.latitudeDelta, 0.0001);
  const fitted = viewAspect > regionAspect
    ? { ...viewport, longitudeDelta: (viewport.latitudeDelta * viewAspect) / longitudeScale }
    : { ...viewport, latitudeDelta: (viewport.longitudeDelta * longitudeScale) / viewAspect };
  return {
    ...fitted,
    latitudeDelta: fitted.latitudeDelta * 1.06,
    longitudeDelta: fitted.longitudeDelta * 1.06,
  };
}

function distanceInKm(from: Pick<MapViewport, 'latitude' | 'longitude'>, to: Pick<MapViewport, 'latitude' | 'longitude'>) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const value = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function useWeatherMap(isPremium = false) {
  const mapRef = useRef<MapView>(null);
  const mapReadyRef = useRef(false);
  const mapSizeRef = useRef({ width: 0, height: 0 });
  const pendingRegionRef = useRef<MapViewport | null>(null);
  const latestViewportRef = useRef<MapViewport>(DEFAULT_VIEWPORT);
  const weatherRequestIdRef = useRef(0);
  const modelRequestIdRef = useRef(0);
  const lastLoadedViewportRef = useRef<MapViewport | null>(null);
  const inFlightViewportRef = useRef<MapViewport | null>(null);
  const lastModelViewportRef = useRef<MapViewport | null>(null);
  const lastGoodConditionsKeyRef = useRef<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [suitability, setSuitability] = useState<SuitabilityResult | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState(false);

  const refreshWeather = useCallback(async (latitude: number, longitude: number) => {
    const requestId = ++weatherRequestIdRef.current;
    setWeatherLoading(true);
    try {
      const latestWeather = await fetchWeatherData(latitude, longitude);
      if (requestId !== weatherRequestIdRef.current) return;
      setWeather(latestWeather);
      setWeatherError(false);
    } catch {
      if (requestId === weatherRequestIdRef.current) setWeatherError(true);
    } finally {
      if (requestId === weatherRequestIdRef.current) setWeatherLoading(false);
    }
  }, []);

  const refreshSuitability = useCallback(async (viewport: MapViewport, mapViewport: MapViewport = viewport) => {
    const requestId = ++modelRequestIdRef.current;
    inFlightViewportRef.current = mapViewport;
    setModelLoading(true);
    const load = () => fetchSuitabilityGrid(viewport, isPremium);
    try {
      let result: SuitabilityResult;
      try {
        result = await load();
      } catch {
        if (requestId !== modelRequestIdRef.current) return;
        result = await load();
      }
      if (requestId !== modelRequestIdRef.current) return;
      setSuitability(result);
      setModelError(false);
      lastLoadedViewportRef.current = mapViewport;
    } catch {
      if (requestId === modelRequestIdRef.current) setModelError(true);
    } finally {
      if (requestId === modelRequestIdRef.current) {
        inFlightViewportRef.current = null;
        setModelLoading(false);
        if (regionMeaningfullyChanged(mapViewport, latestViewportRef.current)) {
          refreshViewportRef.current(latestViewportRef.current);
        }
      }
    }
  }, [isPremium]);

  const refreshViewport = useCallback((viewport: MapViewport, force = false) => {
    const readable = readViewport(viewport);
    if (!readable) return;
    latestViewportRef.current = readable;
    const alreadyLoaded = !regionMeaningfullyChanged(lastLoadedViewportRef.current, readable);
    const alreadyLoading = inFlightViewportRef.current != null
      && !regionMeaningfullyChanged(inFlightViewportRef.current, readable);
    if (!force && (alreadyLoading || alreadyLoaded)) return;
    const covered = viewportForPhone(readable, mapSizeRef.current.width, mapSizeRef.current.height);
    lastModelViewportRef.current = covered;
    void refreshWeather(readable.latitude, readable.longitude);
    void refreshSuitability(covered, readable);
  }, [refreshSuitability, refreshWeather]);

  const refreshViewportRef = useRef(refreshViewport);
  refreshViewportRef.current = refreshViewport;

  const handleRegionChange = useCallback((viewport: MapViewport) => {
    const readable = readViewport(viewport);
    if (!readable) return;
    latestViewportRef.current = readable;
  }, []);

  const handleRegionChangeComplete = useCallback((viewport: MapViewport) => {
    const readable = readViewport(viewport);
    if (!readable) return;
    latestViewportRef.current = readable;
    refreshViewport(readable);
  }, [refreshViewport]);

  const handleMapLayout = useCallback((size: { width: number; height: number }) => {
    const previous = mapSizeRef.current;
    mapSizeRef.current = size;
    const firstMeasurement = previous.width < 1;
    const previousAspect = previous.width / Math.max(previous.height, 1);
    const nextAspect = size.width / Math.max(size.height, 1);
    if ((firstMeasurement || Math.abs(nextAspect - previousAspect) > 0.04) && lastLoadedViewportRef.current) {
      refreshViewport(latestViewportRef.current, true);
    }
  }, [refreshViewport]);

  const handleMapReady = useCallback(() => {
    mapReadyRef.current = true;
    const pending = pendingRegionRef.current;
    pendingRegionRef.current = null;
    if (pending) {
      latestViewportRef.current = pending;
      mapRef.current?.animateToRegion(pending, 450);
      refreshViewport(pending, true);
      return;
    }
    refreshViewport(latestViewportRef.current, true);
  }, [refreshViewport]);

  const refreshCurrentViewport = useCallback(() => {
    refreshViewport(latestViewportRef.current, true);
  }, [refreshViewport]);

  useEffect(() => {
    let isMounted = true;
    let locationSubscription: Location.LocationSubscription | null = null;

    async function loadLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!isMounted) return;

        const nextLocation = { latitude: current.coords.latitude, longitude: current.coords.longitude };
        setLocation(nextLocation);
        const gpsViewport = { ...nextLocation, latitudeDelta: DEFAULT_VIEWPORT.latitudeDelta, longitudeDelta: DEFAULT_VIEWPORT.longitudeDelta };
        latestViewportRef.current = gpsViewport;
        if (mapReadyRef.current) mapRef.current?.animateToRegion(gpsViewport, 450);
        else pendingRegionRef.current = gpsViewport;
        refreshViewport(gpsViewport);

        locationSubscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 60_000, distanceInterval: 250 },
          (position) => setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        );
      } catch {
        // Keep the map usable at its default region if location services are unavailable.
      }
    }

    loadLocation();
    return () => {
      isMounted = false;
      locationSubscription?.remove();
    };
  }, [refreshViewport]);

  useEffect(() => {
    refreshViewport(DEFAULT_VIEWPORT);
    const weatherRefresh = setInterval(() => {
      const viewport = latestViewportRef.current;
      void refreshWeather(viewport.latitude, viewport.longitude);
    }, 15 * 60 * 1000);
    const modelRefresh = setInterval(() => {
      const viewport = lastModelViewportRef.current;
      if (viewport) void refreshSuitability(viewport);
    }, 30 * 60 * 1000);
    return () => {
      clearInterval(weatherRefresh);
      clearInterval(modelRefresh);
    };
  }, [refreshSuitability, refreshViewport, refreshWeather]);

  const summary = useMemo(() => summarizeSuitability(suitability), [suitability]);

  const premiumInsight = useMemo<PremiumInsight | null>(() => {
    if (!summary || !weather || !suitability) return null;

    const hotspotCells = [...suitability.cells]
      .sort((left, right) => right.score - left.score)
      .slice(0, 3)
      .map((cell) => ({
        label: `${cell.soilTexture ? cell.soilTexture.charAt(0).toUpperCase() + cell.soilTexture.slice(1) : 'Strefa'} ${cell.id}`,
        score: Math.round(cell.score),
        habitat: cell.soilTexture ? `${cell.soilTexture} · ${Math.round(cell.elevation ?? 0)} m n.p.m.` : `Wysokość: ${Math.round(cell.elevation ?? 0)} m n.p.m.`,
      }));

    const goodConditions = summary.score >= 60 && (weather.temperature ?? 0) >= 8 && (weather.temperature ?? 0) <= 22 && (weather.humidity ?? 0) >= 55 && (weather.humidity ?? 0) <= 90 && (weather.rainfall ?? 0) <= 6;
    const bestWindow = goodConditions
      ? 'Najlepsza pora: 10:00–15:00, przy umiarkowanej wilgotności i niskim ryzyku deszczu.'
      : 'Najlepszy okres: wczesne popołudnie, gdy gleba jest wilgotna, ale nie nadmiernie mokra.';

    const riskLabel = (weather.rainfall ?? 0) > 8 ? 'Wysokie ryzyko wilgoci' : (weather.rainfall ?? 0) > 4 ? 'Umiarkowane warunki' : 'Niskie ryzyko deszczu';

    const microclimate = goodConditions
      ? 'Mikroklimat sprzyja grzybom: temperatura i wilgotność są zbliżone do optymalnych warunków do poszukiwań.'
      : 'Warunki są zbliżone do średnich. Dodatkowe obserwacje w zacienionych, wilgotnych strefach mogą dać lepszy wynik.';

    return {
      bestWindow,
      riskLabel,
      microclimate,
      hotspots: hotspotCells,
    };
  }, [summary, weather, suitability]);

  useEffect(() => {
    if (!isPremium || !summary || !weather) return;

    const goodConditionsScore = summary.score >= 60;
    const goodTemperature = weather.temperature >= 8 && weather.temperature <= 22;
    const goodHumidity = weather.humidity >= 55 && weather.humidity <= 90;
    const lowRain = weather.rainfall <= 6;
    const notificationKey = `${summary.score}-${weather.temperature.toFixed(1)}-${weather.humidity}-${weather.rainfall.toFixed(1)}`;

    if (!goodConditionsScore || !goodTemperature || !goodHumidity || !lowRain) {
      lastGoodConditionsKeyRef.current = null;
      return;
    }

    if (lastGoodConditionsKeyRef.current === notificationKey) return;
    lastGoodConditionsKeyRef.current = notificationKey;

    // void import('expo-notifications')
    //   .then((Notifications) => {
    //     return Notifications.requestPermissionsAsync().then(({ status }) => {
    //       if (status !== 'granted') return;
    //       return Notifications.scheduleNotificationAsync({
    //         content: {
    //           title: 'Dobry moment na grzyby',
    //           body: `Warunki są sprzyjające: ocena ${summary.score}/100, ${weather.temperature.toFixed(1)}°C, wilgotność ${weather.humidity}%`,
    //         },
    //         trigger: {
    //           type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
    //           seconds: 5,
    //         },
    //       });
    //     });
    //   })
    //   .catch(() => undefined);
  }, [isPremium, summary, weather]);

  const potentialSpecies = useMemo(() => findPotentialSpecies(summary), [summary]);

  return {
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
  };
}
