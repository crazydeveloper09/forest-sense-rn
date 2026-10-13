import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const latestViewportRef = useRef<MapViewport>(DEFAULT_VIEWPORT);
  const pendingViewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRequestedViewportRef = useRef<string | null>(null);
  const weatherRequestIdRef = useRef(0);
  const modelRequestIdRef = useRef(0);
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

  const refreshSuitability = useCallback(async (viewport: MapViewport) => {
    const requestId = ++modelRequestIdRef.current;
    setModelLoading(true);
    setSuitability(null);
    try {
      const result = await fetchSuitabilityGrid(viewport, isPremium);
      if (requestId !== modelRequestIdRef.current) return;
      setSuitability(result);
      setModelError(false);
    } catch {
      if (requestId === modelRequestIdRef.current) setModelError(true);
    } finally {
      if (requestId === modelRequestIdRef.current) setModelLoading(false);
    }
  }, [isPremium]);

  const refreshViewport = useCallback((viewport: MapViewport, force = false) => {
    const viewportKey = [viewport.latitude.toFixed(3), viewport.longitude.toFixed(3), viewport.latitudeDelta.toFixed(3), viewport.longitudeDelta.toFixed(3)].join(':');
    latestViewportRef.current = viewport;
    if (!force && lastRequestedViewportRef.current === viewportKey) return;
    lastRequestedViewportRef.current = viewportKey;
    lastModelViewportRef.current = viewport;
    void refreshWeather(viewport.latitude, viewport.longitude);
    void refreshSuitability(viewport);
  }, [refreshSuitability, refreshWeather]);

  const handleRegionChangeComplete = useCallback((viewport: MapViewport) => {
    latestViewportRef.current = viewport;
    if (pendingViewportTimerRef.current) clearTimeout(pendingViewportTimerRef.current);
    pendingViewportTimerRef.current = setTimeout(() => refreshViewport(viewport), 650);
  }, [refreshViewport]);

  const refreshCurrentViewport = useCallback(() => refreshViewport(latestViewportRef.current, true), [refreshViewport]);

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
        mapRef.current?.animateToRegion(gpsViewport);
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
      if (pendingViewportTimerRef.current) clearTimeout(pendingViewportTimerRef.current);
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

    void import('expo-notifications')
      .then((Notifications) => {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: false,
            shouldSetBadge: false,
          }),
        });
        return Notifications.requestPermissionsAsync().then(({ status }) => {
          if (status !== 'granted') return;
          return Notifications.scheduleNotificationAsync({
            content: {
              title: 'Dobry moment na grzyby',
              body: `Warunki są sprzyjające: ocena ${summary.score}/100, ${weather.temperature.toFixed(1)}°C, wilgotność ${weather.humidity}%`,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: 5,
            },
          });
        });
      })
      .catch(() => undefined);
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
    handleRegionChangeComplete,
  };
}
