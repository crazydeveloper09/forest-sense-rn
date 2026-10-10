export type WeatherData = {
  temperature: number;
  humidity: number;
  rainfall: number;
  wind: number;
  condition: string;
  recommendation: string;
  updatedAt: string;
};

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    wind_speed_10m?: number;
    weather_code?: number;
    time?: string;
  };
};

function describeWeatherCode(code: number): string {
  if (code === 0) return 'Bezchmurnie';
  if ([1, 2, 3].includes(code)) return 'Częściowe zachmurzenie';
  if ([45, 48].includes(code)) return 'Mgła';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Mżawka';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Deszcz';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Śnieg';
  if ([95, 96, 99].includes(code)) return 'Burza';
  return 'Warunki zmienne';
}

export async function fetchWeatherData(latitude: number, longitude: number): Promise<WeatherData> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', latitude.toString());
  url.searchParams.set('longitude', longitude.toString());
  url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code');
  url.searchParams.set('timezone', 'auto');

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Weather request failed: ${response.status}`);
  }

  const data = (await response.json()) as OpenMeteoResponse;
  const current = data.current;

  if (!current || current.temperature_2m === undefined) {
    throw new Error('Weather response did not include current conditions');
  }

  const humidity = current.relative_humidity_2m ?? 0;
  const rainfall = current.precipitation ?? 0;
  const temperature = current.temperature_2m;
  let recommendation = 'Warunki przeciętne — sprawdź lokalne obserwacje i las po opadach.';

  if (humidity >= 75 && rainfall > 0) {
    recommendation = 'Wilgotno i po opadach — sprawdź zacienione, leśne miejsca. To wskazówka pogodowa, nie potwierdzenie występowania grzybów.';
  } else if (humidity >= 75) {
    recommendation = 'Wysoka wilgotność sprzyja utrzymaniu wilgoci w lesie. To wskazówka pogodowa, nie potwierdzenie występowania grzybów.';
  } else if (temperature < 5 || temperature > 28) {
    recommendation = 'Temperatura może ograniczać aktywność wielu gatunków. Sprawdź lokalne obserwacje.';
  }

  return {
    temperature,
    humidity,
    rainfall,
    wind: current.wind_speed_10m ?? 0,
    condition: describeWeatherCode(current.weather_code ?? -1),
    recommendation,
    updatedAt: current.time ?? new Date().toISOString(),
  };
}
