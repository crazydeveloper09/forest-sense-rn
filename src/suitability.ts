export type SuitabilityCell = {
  id: string;
  latitude: number;
  longitude: number;
  boundary: Coordinate[];
  score: number;
  elevation: number | null;
  slope: number | null;
  soilMoisture: number | null;
  soilTexture: string | null;
  rainfall72h: number | null;
  temperature: number | null;
};

export type SuitabilityResult = {
  cells: SuitabilityCell[];
  updatedAt: string;
  soilDataAvailable: boolean;
};

type Coordinate = { latitude: number; longitude: number };
export type MapViewport = Coordinate & { latitudeDelta: number; longitudeDelta: number };
type SoilProperties = { sand: number | null; silt: number | null; clay: number | null };
type WeatherPoint = {
  latitude?: number;
  longitude?: number;
  elevation?: number;
  current?: {
    time?: string;
    temperature_2m?: number;
    soil_moisture_0_to_1cm?: number;
    soil_moisture_9_to_27cm?: number;
  };
  hourly?: {
    time?: string[];
    precipitation?: Array<number | null>;
  };
  daily?: {
    time?: string[];
    precipitation_sum?: Array<number | null>;
  };
};
type SoilGridResponse = {
  properties?: {
    layers?: Array<{
      name?: string;
      depths?: Array<{ values?: { mean?: number | null } }>;
    }>;
  };
};

const TIMEOUT_MS = 20_000;
const WEATHER_SAMPLE_SIZE = 3;
const FREE_GRID_SIZE = 8;
const PREMIUM_GRID_SIZE = 10;
const soilCache = new Map<string, Promise<SoilProperties | null>>();

async function fetchJson<T>(url: URL): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) throw new Error(`Environmental data request failed: ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function buildGrid(viewport: MapViewport, gridSize: number): Array<Coordinate & { row: number; column: number; boundary: Coordinate[] }> {
  const latitudeDelta = Math.min(Math.max(viewport.latitudeDelta, 0.002), 60);
  const longitudeDelta = Math.min(Math.max(viewport.longitudeDelta, 0.002), 120);
  const south = Math.max(-85, viewport.latitude - latitudeDelta / 2);
  const north = Math.min(85, viewport.latitude + latitudeDelta / 2);
  const west = viewport.longitude - longitudeDelta / 2;
  const east = viewport.longitude + longitudeDelta / 2;
  const latitudeStep = (north - south) / gridSize;
  const longitudeStep = (east - west) / gridSize;

  return Array.from({ length: gridSize }, (_, row) =>
    Array.from({ length: gridSize }, (_, column) => {
      const cellSouth = south + row * latitudeStep;
      const cellNorth = cellSouth + latitudeStep;
      const cellWest = west + column * longitudeStep;
      const cellEast = cellWest + longitudeStep;
      return {
        row,
        column,
        latitude: (cellSouth + cellNorth) / 2,
        longitude: (cellWest + cellEast) / 2,
        boundary: [
          { latitude: cellNorth, longitude: cellWest },
          { latitude: cellNorth, longitude: cellEast },
          { latitude: cellSouth, longitude: cellEast },
          { latitude: cellSouth, longitude: cellWest },
        ],
      };
    }),
  ).flat();
}

function parseSoilValue(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  // SoilGrids values are reported in g/kg; the d_factor converts them to percent.
  const percent = value > 100 ? value / 10 : value;
  return Math.max(0, Math.min(100, percent));
}

async function fetchSoilProperties(point: Coordinate): Promise<SoilProperties | null> {
  const cacheKey = `${point.latitude.toFixed(2)}:${point.longitude.toFixed(2)}`;
  const cached = soilCache.get(cacheKey);
  if (cached) return cached;

  const request = fetchSoilPropertiesUncached(point);
  soilCache.set(cacheKey, request);
  if (soilCache.size > 500) {
    const firstKey = soilCache.keys().next().value;
    if (firstKey) soilCache.delete(firstKey);
  }
  return request;
}

async function fetchSoilPropertiesUncached(point: Coordinate): Promise<SoilProperties | null> {
  const url = new URL('https://rest.isric.org/soilgrids/v2.0/properties/query');
  url.searchParams.set('lon', point.longitude.toString());
  url.searchParams.set('lat', point.latitude.toString());
  ['sand', 'silt', 'clay'].forEach((property) => url.searchParams.append('property', property));
  url.searchParams.set('depth', '0-5cm');
  url.searchParams.set('value', 'mean');

  try {
    const response = await fetchJson<SoilGridResponse>(url);
    const layers = response.properties?.layers ?? [];
    const valueFor = (name: string) => {
      const value = layers.find((layer) => layer.name === name)?.depths?.[0]?.values?.mean;
      return parseSoilValue(value);
    };
    const soil = { sand: valueFor('sand'), silt: valueFor('silt'), clay: valueFor('clay') };
    return soil.sand == null && soil.silt == null && soil.clay == null ? null : soil;
  } catch {
    return null;
  }
}

function textureName(soil: SoilProperties | null): string | null {
  if (!soil || soil.sand == null || soil.clay == null || soil.silt == null) return null;
  if (soil.clay >= 40) return 'gliniasta';
  if (soil.sand >= 70) return 'piaszczysta';
  if (soil.sand >= 43 && soil.clay < 20) return 'piaszczysto-gliniasta';
  return 'gliniasto-piaszczysta';
}

function textureSuitability(soil: SoilProperties | null): number | null {
  if (!soil || soil.sand == null || soil.clay == null || soil.silt == null) return null;
  // A broad drainage/retention proxy, not a species-specific soil classification.
  const sandPenalty = Math.max(0, soil.sand - 75) * 1.2;
  const clayPenalty = Math.max(0, soil.clay - 45) * 1.1;
  return Math.max(0, Math.min(100, 90 - sandPenalty - clayPenalty));
}

function temperatureSuitability(temperature: number): number {
  if (temperature < 0 || temperature > 30) return 10;
  if (temperature < 5) return 10 + temperature * 6;
  if (temperature <= 18) return 75 + ((temperature - 5) / 13) * 25;
  return Math.max(15, 100 - (temperature - 18) * 10);
}

function moistureSuitability(moisture: number): number {
  // Open-Meteo soil moisture is volumetric water content (m³/m³).
  if (moisture < 0.08) return Math.max(0, moisture * 250);
  if (moisture <= 0.35) return 70 + ((moisture - 0.08) / 0.27) * 30;
  return Math.max(45, 100 - (moisture - 0.35) * 140);
}

function rainfallSuitability(rainfall: number): number {
  return Math.max(0, Math.min(100, (rainfall / 18) * 100));
}

function slopeSuitability(slope: number): number {
  if (slope <= 8) return 90 + (slope / 8) * 10;
  if (slope <= 20) return 100 - ((slope - 8) / 12) * 55;
  return Math.max(15, 45 - (slope - 20) * 1.5);
}

function getSoilMoisture(point: WeatherPoint): number | null {
  const shallow = point.current?.soil_moisture_0_to_1cm;
  const deeper = point.current?.soil_moisture_9_to_27cm;
  if (shallow == null && deeper == null) return null;
  if (shallow == null) return deeper ?? null;
  if (deeper == null) return shallow;
  return shallow * 0.35 + deeper * 0.65;
}

function sumRecentRain(point: WeatherPoint): number | null {
  const daily = point.daily?.precipitation_sum;
  if (daily?.length) {
    const past = daily.length > 1 ? daily.slice(0, -1) : daily;
    return past.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  }
  const precipitation = point.hourly?.precipitation;
  if (!precipitation?.length) return null;
  const currentTime = point.current?.time?.slice(0, 13);
  const currentIndex = currentTime
    ? (point.hourly?.time ?? []).findIndex((time) => time.startsWith(currentTime))
    : -1;
  const end = currentIndex >= 0 ? currentIndex + 1 : precipitation.length;
  const start = Math.max(0, end - 72);
  return precipitation.slice(start, end).reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function estimateSlope(
  points: WeatherPoint[],
  index: number,
  gridSize: number,
  latitudeStep: number,
  longitudeStep: number,
): number | null {
  const elevation = points[index]?.elevation;
  if (elevation == null) return null;
  const row = Math.floor(index / gridSize);
  const column = index % gridSize;
  const latitudeSpacingMeters = latitudeStep * 111_000;
  const longitudeMeters = longitudeStep * 111_000 * Math.cos((points[index].latitude! * Math.PI) / 180);
  const north = row > 0 ? points[index - gridSize]?.elevation : undefined;
  const south = row < gridSize - 1 ? points[index + gridSize]?.elevation : undefined;
  const west = column > 0 ? points[index - 1]?.elevation : undefined;
  const east = column < gridSize - 1 ? points[index + 1]?.elevation : undefined;
  const northSouth = north != null && south != null ? (south - north) / (2 * latitudeSpacingMeters) :
    north != null ? (elevation - north) / latitudeSpacingMeters : south != null ? (south - elevation) / latitudeSpacingMeters : null;
  const eastWest = west != null && east != null ? (east - west) / (2 * longitudeMeters) :
    west != null ? (elevation - west) / longitudeMeters : east != null ? (east - elevation) / longitudeMeters : null;
  if (northSouth == null && eastWest == null) return null;
  return Math.atan(Math.hypot(northSouth ?? 0, eastWest ?? 0)) * (180 / Math.PI);
}

function buildScore(
  moisture: number | null,
  rainfall: number | null,
  temperature: number | null,
  slope: number | null,
  soil: SoilProperties | null,
): number {
  const factors: Array<{ value: number | null; weight: number }> = [
    { value: moisture == null ? null : moistureSuitability(moisture), weight: 30 },
    { value: rainfall == null ? null : rainfallSuitability(rainfall), weight: 25 },
    { value: temperature == null ? null : temperatureSuitability(temperature), weight: 15 },
    { value: slope == null ? null : slopeSuitability(slope), weight: 15 },
    { value: textureSuitability(soil), weight: 15 },
  ];
  const available = factors.filter((factor) => factor.value != null);
  if (!available.length) return 0;
  const totalWeight = available.reduce((sum, factor) => sum + factor.weight, 0);
  return Math.round(available.reduce((sum, factor) => sum + factor.value! * factor.weight, 0) / totalWeight);
}

function nearestWeatherPoint(points: WeatherPoint[], coordinate: Coordinate) {
  return points.reduce((nearest, point) => {
    const latitude = point.latitude ?? coordinate.latitude;
    const longitude = point.longitude ?? coordinate.longitude;
    const distance = Math.hypot(latitude - coordinate.latitude, longitude - coordinate.longitude);
    return distance < nearest.distance ? { point, distance } : nearest;
  }, { point: points[0], distance: Number.POSITIVE_INFINITY }).point;
}

export async function fetchSuitabilityGrid(viewport: MapViewport, detailed = false): Promise<SuitabilityResult> {
  const gridSize = detailed ? PREMIUM_GRID_SIZE : FREE_GRID_SIZE;
  const grid = buildGrid(viewport, gridSize);
  const coordinates = grid.map(({ latitude, longitude }) => ({ latitude, longitude }));
  const latitudeStep = Math.min(Math.max(viewport.latitudeDelta, 0.002), 60) / gridSize;
  const longitudeStep = Math.min(Math.max(viewport.longitudeDelta, 0.002), 120) / gridSize;
  const samples = buildGrid(viewport, WEATHER_SAMPLE_SIZE).map(({ latitude, longitude }) => ({ latitude, longitude }));
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', samples.map((point) => point.latitude.toFixed(5)).join(','));
  url.searchParams.set('longitude', samples.map((point) => point.longitude.toFixed(5)).join(','));
  url.searchParams.set('current', 'temperature_2m,soil_moisture_0_to_1cm,soil_moisture_9_to_27cm');
  url.searchParams.set('daily', 'precipitation_sum');
  url.searchParams.set('past_days', '3');
  url.searchParams.set('forecast_days', '1');
  url.searchParams.set('timezone', 'auto');

  const weatherResponse = await fetchJson<WeatherPoint | WeatherPoint[]>(url);
  const returnedPoints = Array.isArray(weatherResponse) ? weatherResponse : [weatherResponse];
  if (!returnedPoints.length) {
    throw new Error('Environmental forecast returned no locations');
  }
  const weatherPoints = coordinates.map((coordinate) => nearestWeatherPoint(returnedPoints, coordinate));

  // SoilGrids is static, unlike weather. Sample the four corners and center to reduce calls;
  // each map cell uses the nearest sampled soil profile.
  const midpoint = Math.floor(gridSize / 2);
  const soilSampleIndexes = [0, gridSize - 1, midpoint * gridSize + midpoint, gridSize * (gridSize - 1), gridSize * gridSize - 1];
  const soilSamples = await Promise.all(
    soilSampleIndexes.map((index) => fetchSoilProperties(coordinates[index])),
  );
  const availableSoilSamples = soilSamples
    .map((soil, sampleIndex) => ({ soil, point: coordinates[soilSampleIndexes[sampleIndex]] }))
    .filter((sample): sample is { soil: SoilProperties; point: Coordinate } => sample.soil != null);

  const cells = weatherPoints.map((point, index) => {
    const soil = availableSoilSamples.reduce<{ soil: SoilProperties | null; distance: number }>(
      (nearest, sample) => {
        const distance = Math.hypot(
          (sample.point.latitude - coordinates[index].latitude) * 111,
          (sample.point.longitude - coordinates[index].longitude) * 111 * Math.cos((viewport.latitude * Math.PI) / 180),
        );
        return distance < nearest.distance ? { soil: sample.soil, distance } : nearest;
      },
      { soil: null, distance: Number.POSITIVE_INFINITY },
    ).soil;
    const moisture = getSoilMoisture(point);
    const rainfall = sumRecentRain(point);
    const temperature = point.current?.temperature_2m ?? null;
    const slope = estimateSlope(weatherPoints, index, gridSize, latitudeStep, longitudeStep);

    return {
      id: `environment-${index}`,
      latitude: coordinates[index].latitude,
      longitude: coordinates[index].longitude,
      boundary: grid[index].boundary,
      score: buildScore(moisture, rainfall, temperature, slope, soil),
      elevation: point.elevation ?? null,
      slope,
      soilMoisture: moisture,
      soilTexture: textureName(soil),
      rainfall72h: rainfall,
      temperature,
    };
  });

  return {
    cells,
    updatedAt: weatherPoints[0]?.current?.time ?? new Date().toISOString(),
    soilDataAvailable: availableSoilSamples.length > 0,
  };
}
