import { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { identifyMushroomImage, type MushroomIdentification } from '../../ai';
import {
  BillingApiError,
  claimDevelopmentReward,
  createRewardRequest,
  getUsage,
  rememberUsage,
  subscribeUsage,
  waitForRewardCredit,
  type UsageStatus,
} from '../../billing';
import { saveObservation } from '../../storage';

type SourceMode = 'camera' | 'gallery' | 'none';

type RecognitionState = {
  sourceMode: SourceMode;
  imageUri: string | null;
  result: MushroomIdentification | null;
  isAnalyzing: boolean;
  analysisError: string | null;
  usage: UsageStatus | null;
  usageLoading: boolean;
  adLoading: boolean;
  locationLabel: string;
  saved: boolean;
};

export function useAIRecognition(adsEnabled: boolean, isPremium: boolean) {
  const [sourceMode, setSourceMode] = useState<SourceMode>('camera');
  const [saved, setSaved] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<MushroomIdentification | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageStatus | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [adLoading, setAdLoading] = useState(false);
  const [locationLabel, setLocationLabel] = useState('Pobieranie lokalizacji…');
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadLocation() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationLabel('Lokalizacja niedostępna');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!isMounted) return;
      const nextLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setCurrentLocation(nextLocation);
      const place = (await Location.reverseGeocodeAsync(nextLocation))[0];
      if (!isMounted) return;
      const named = place ? [place.street, place.city, place.region].filter(Boolean).join(', ') : '';
      setLocationLabel(named || 'Twoja lokalizacja');
    }

    loadLocation().catch(() => setLocationLabel('Lokalizacja niedostępna'));
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    getUsage()
      .then((latestUsage) => {
        if (isMounted) setUsage(latestUsage);
      })
      .catch((error: unknown) => {
        if (isMounted) setAnalysisError(error instanceof Error ? error.message : 'Nie udało się pobrać limitu AI.');
      })
      .finally(() => {
        if (isMounted) setUsageLoading(false);
      });
    const unsubscribe = subscribeUsage((latestUsage) => {
      if (isMounted) setUsage(latestUsage);
    });
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const analyzeImage = async (base64: string | null | undefined, mimeType: string | null | undefined) => {
    setResult(null);
    setAnalysisError(null);
    setSaved(false);
    if (usage && !usage.canRecognize) {
      setAnalysisError('Wykorzystano dostępny limit rozpoznań. Obejrzyj reklamę, aby odblokować jedno dodatkowe rozpoznanie.');
      return;
    }
    if (!base64) {
      setAnalysisError('Nie udało się odczytać zdjęcia. Wybierz je ponownie lub zrób nowe.');
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await identifyMushroomImage(base64, mimeType || 'image/jpeg');
      setResult(response.identification);
      setUsage(rememberUsage(response.usage));
    } catch (error) {
      if (error instanceof BillingApiError && error.usage) setUsage(rememberUsage(error.usage));
      setAnalysisError(error instanceof Error ? error.message : 'Nie udało się przeanalizować zdjęcia.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const openCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, base64: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setImageUri(asset.uri);
    setSourceMode('camera');
    await analyzeImage(asset.base64, asset.mimeType);
  };

  const openGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, base64: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setImageUri(asset.uri);
    setSourceMode('gallery');
    await analyzeImage(asset.base64, asset.mimeType);
  };

  const watchRewardedAd = async () => {
    if (!adsEnabled || !usage || usage.canRecognize || usage.plan === 'premium') return;
    setAdLoading(true);
    setAnalysisError(null);
    try {
      const { AdEventType, RewardedAd, RewardedAdEventType, TestIds } = await import('react-native-google-mobile-ads');
      const adUnitId = __DEV__ ? TestIds.REWARDED : process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID;
      if (!adUnitId) throw new Error('Brak produkcyjnego identyfikatora reklamy rewarded.');
      const request = await createRewardRequest();
      const ad = RewardedAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
        serverSideVerificationOptions: { userId: request.userId, customData: request.customData },
      });
      const earnedReward = await new Promise<boolean>((resolve, reject) => {
        let earned = false;
        let finished = false;
        let removeLoaded = () => {};
        let removeEarned = () => {};
        let removeClosed = () => {};
        let removeError = () => {};
        const finish = (callback: () => void) => {
          if (finished) return;
          finished = true;
          removeLoaded();
          removeEarned();
          removeClosed();
          removeError();
          ad.destroy();
          callback();
        };
        removeLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
          void ad.show().catch((error: unknown) => finish(() => reject(error)));
        });
        removeEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { earned = true; });
        removeClosed = ad.addAdEventListener(AdEventType.CLOSED, () => finish(() => resolve(earned)));
        removeError = ad.addAdEventListener(AdEventType.ERROR, (error) => finish(() => reject(error)));
        ad.load();
      });

      if (!earnedReward) {
        setAnalysisError('Reklama nie została obejrzana do końca. Limit nie został zwiększony.');
        return;
      }
      const latestUsage = __DEV__ ? await claimDevelopmentReward(request.customData) : await waitForRewardCredit();
      setUsage(rememberUsage(latestUsage));
      if (latestUsage.rewardCredits === 0) setAnalysisError('Weryfikacja nagrody trwa dłużej. Odśwież limit za chwilę.');
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'Nie udało się załadować reklamy. Spróbuj ponownie.');
    } finally {
      setAdLoading(false);
    }
  };

  const saveCurrentObservation = () => {
    if (!result?.identified) return;
    if (!isPremium) {
      setAnalysisError('Zapis obserwacji jest dostępny tylko dla użytkowników Premium. Aktywuj plan Premium, aby zachować wynik.');
      return;
    }
    saveObservation(
      result.name,
      result.confidence,
      `${result.description} Wynik wstępnego rozpoznania AI. Źródło: ${sourceMode === 'camera' ? 'aparat' : 'galeria'}. Lokalizacja: ${locationLabel}.`,
      currentLocation?.latitude,
      currentLocation?.longitude,
    );
    setSaved(true);
  };

  const state: RecognitionState = {
    sourceMode,
    imageUri,
    result,
    isAnalyzing,
    analysisError,
    usage,
    usageLoading,
    adLoading,
    locationLabel,
    saved,
  };

  return { state, actions: { openCamera, openGallery, watchRewardedAd, saveCurrentObservation } };
}
