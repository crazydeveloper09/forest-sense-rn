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
