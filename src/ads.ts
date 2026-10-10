import Constants, { AppOwnership } from 'expo-constants';

export async function initializeGoogleMobileAds(): Promise<boolean> {
  if (Constants.appOwnership === AppOwnership.Expo) return false;

  try {
    const ads = await import('react-native-google-mobile-ads');
    const { AdsConsent } = ads;
    const consent = await AdsConsent.gatherConsent();
    if (!consent.canRequestAds) return false;
    await ads.default().initialize();
    return true;
  } catch {
    return false;
  }
}
