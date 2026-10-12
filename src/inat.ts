export type INaturalistTaxon = {
  id: number;
  name: string;
  preferred_common_name?: string;
  rank?: string;
  wikipedia_url?: string;
  default_photo?: {
    medium_url?: string;
    attribution?: string;
    license_code?: string;
  };
};

type TaxaResponse = {
  total_results?: number;
  results?: INaturalistTaxon[];
};

export type FungiCatalogPage = {
  taxa: INaturalistTaxon[];
  totalResults: number;
};

export async function fetchFungiCatalog(page = 1, signal?: AbortSignal): Promise<FungiCatalogPage> {
  const url = new URL('https://api.inaturalist.org/v1/taxa');
  url.searchParams.set('taxon_id', '47170'); // Fungi
  url.searchParams.set('rank', 'species');
  url.searchParams.set('per_page', '50');
  url.searchParams.set('page', String(page));
  url.searchParams.set('order_by', 'observations_count');
  url.searchParams.set('order', 'desc');
  url.searchParams.set('locale', 'pl');

  const response = await fetch(url.toString(), {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`iNaturalist zwrócił błąd ${response.status}.`);

  const data = (await response.json()) as TaxaResponse;
  return {
    taxa: (data.results ?? []).filter((taxon) => taxon.rank === 'species'),
    totalResults: data.total_results ?? 0,
  };
}

export async function searchFungi(query: string, signal?: AbortSignal): Promise<INaturalistTaxon[]> {
  const url = new URL('https://api.inaturalist.org/v1/taxa/autocomplete');
  url.searchParams.set('q', query.trim());
  url.searchParams.set('taxon_id', '47170'); // Fungi
  url.searchParams.set('rank', 'species,subspecies');
  url.searchParams.set('per_page', '12');
  url.searchParams.set('locale', 'pl');

  const response = await fetch(url.toString(), {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`iNaturalist zwrócił błąd ${response.status}.`);

  const data = (await response.json()) as TaxaResponse;
  return (data.results ?? []).filter((taxon) => taxon.rank === 'species' || taxon.rank === 'subspecies');
}

type TaxonAncestor = {
  id: number;
  rank?: string;
  name: string;
};

type TaxonDetail = INaturalistTaxon & {
  wikipedia_summary?: string;
  parent_id?: number;
  ancestors?: TaxonAncestor[];
};

type TaxonDetailResponse = {
  results?: TaxonDetail[];
};

export type TaxonProfile = {
  id: number;
  summary: string | null;
  wikipediaUrl?: string;
  genusId: number | null;
};

type ObservationResponse = {
  total_results?: number;
  results?: Array<{ place_guess?: string | null }>;
};

async function readJson<T>(url: URL, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url.toString(), {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`iNaturalist zwrócił błąd ${response.status}.`);
  return (await response.json()) as T;
}

export async function fetchTaxonProfile(scientificName: string, taxonId?: number, signal?: AbortSignal): Promise<TaxonProfile | null> {
  const id = taxonId ?? await findTaxonId(scientificName, signal);
  if (!id) return null;

  const url = new URL(`https://api.inaturalist.org/v1/taxa/${id}`);
  url.searchParams.set('locale', 'pl');
  const data = await readJson<TaxonDetailResponse>(url, signal);
  const taxon = data.results?.[0];
  if (!taxon) return null;
  const genus = taxon.ancestors?.find((ancestor) => ancestor.rank === 'genus');
  return {
    id: taxon.id,
    summary: taxon.wikipedia_summary?.trim() || null,
    wikipediaUrl: taxon.wikipedia_url,
    genusId: genus?.id ?? taxon.parent_id ?? null,
  };
}

async function findTaxonId(scientificName: string, signal?: AbortSignal): Promise<number | null> {
  const url = new URL('https://api.inaturalist.org/v1/taxa');
  url.searchParams.set('q', scientificName);
  url.searchParams.set('rank', 'species');
  url.searchParams.set('per_page', '5');
  url.searchParams.set('locale', 'pl');
  const data = await readJson<TaxaResponse>(url, signal);
  const exact = (data.results ?? []).find((taxon) => taxon.name.toLowerCase() === scientificName.toLowerCase());
  return exact?.id ?? data.results?.[0]?.id ?? null;
}

export async function fetchPolishWikipediaExtract(wikipediaUrl: string, signal?: AbortSignal): Promise<string | null> {
  let page: URL;
  try {
    page = new URL(wikipediaUrl);
  } catch {
    return null;
  }
  if (page.hostname !== 'pl.wikipedia.org') return null;
  const title = decodeURIComponent(page.pathname.replace(/^\/wiki\//, ''));
  if (!title) return null;

  const response = await fetch(`https://pl.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { extract?: string; extract_html?: string };
  const extract = data.extract_html?.trim() || data.extract?.trim();
  return extract || null;
}

export async function fetchSimilarTaxa(genusId: number, excludeId: number, signal?: AbortSignal): Promise<INaturalistTaxon[]> {
  const url = new URL('https://api.inaturalist.org/v1/taxa');
  url.searchParams.set('taxon_id', String(genusId));
  url.searchParams.set('rank', 'species');
  url.searchParams.set('per_page', '8');
  url.searchParams.set('order_by', 'observations_count');
  url.searchParams.set('order', 'desc');
  url.searchParams.set('locale', 'pl');
  const data = await readJson<TaxaResponse>(url, signal);
  return (data.results ?? []).filter((taxon) => taxon.id !== excludeId && taxon.rank === 'species').slice(0, 5);
}

export async function fetchRecentPlaces(taxonId: number, signal?: AbortSignal): Promise<string[]> {
  const url = new URL('https://api.inaturalist.org/v1/observations');
  url.searchParams.set('taxon_id', String(taxonId));
  url.searchParams.set('per_page', '6');
  url.searchParams.set('order_by', 'observed_on');
  url.searchParams.set('order', 'desc');
  url.searchParams.set('locale', 'pl');
  const data = await readJson<ObservationResponse>(url, signal);
  const places = (data.results ?? [])
    .map((observation) => observation.place_guess?.trim())
    .filter((place): place is string => Boolean(place));
  return [...new Set(places)].slice(0, 5);
}

export async function fetchNearbyObservationCount(
  taxonId: number,
  latitude: number,
  longitude: number,
  radiusKm: number,
  signal?: AbortSignal,
): Promise<number> {
  const url = new URL('https://api.inaturalist.org/v1/observations');
  url.searchParams.set('taxon_id', String(taxonId));
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lng', String(longitude));
  url.searchParams.set('radius', String(radiusKm));
  url.searchParams.set('verifiable', 'true');
  url.searchParams.set('per_page', '1');
  const data = await readJson<ObservationResponse>(url, signal);
  return data.total_results ?? 0;
}
