export type SubscriptionTier = 'free' | 'premium';

export type ObservationRecord = {
  id: number;
  name: string;
  probability: number;
  notes: string;
  latitude?: number | null;
  longitude?: number | null;
  createdAt: string;
};

export type WeatherCondition = {
  temperature: number;
  humidity: number;
  rainfall: number;
  wind: number;
};
