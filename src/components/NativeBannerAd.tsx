import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';

type Props = { unitId: string };

export default function NativeBannerAd({ unitId }: Props) {
  return (
    <BannerAd
      unitId={unitId}
      size={BannerAdSize.BANNER}
      requestOptions={{ requestNonPersonalizedAdsOnly: true }}
    />
  );
}
