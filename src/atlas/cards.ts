import type { INaturalistTaxon } from '../inat';
import { MUSHROOM_ATLAS, type AtlasSpecies, type EdibilityCategory } from '../mushroomAtlas';

export type AtlasCard = {
  key: string;
  name: string;
  scientificName: string;
  category: EdibilityCategory | 'unknown';
  description: string;
  habitat: string;
  photoUrl?: string;
  attribution?: string;
  license?: string;
  wikipediaUrl?: string;
  local: boolean;
};

export function toCard(species: AtlasSpecies, taxon?: INaturalistTaxon): AtlasCard {
  return {
    key: species.scientificName,
    name: species.polishName,
    scientificName: species.scientificName,
    category: species.category,
    description: species.description,
    habitat: species.habitat,
    photoUrl: taxon?.default_photo?.medium_url,
    attribution: taxon?.default_photo?.attribution,
    license: taxon?.default_photo?.license_code,
    wikipediaUrl: taxon?.wikipedia_url,
    local: true,
  };
}

export function remoteCard(taxon: INaturalistTaxon): AtlasCard {
  const local = MUSHROOM_ATLAS.find((species) => species.scientificName.toLowerCase() === taxon.name.toLowerCase());
  return {
    key: `inat-${taxon.id}`,
    name: taxon.preferred_common_name || local?.polishName || taxon.name,
    scientificName: taxon.name,
    category: local?.category ?? 'unknown',
    description: local?.description ?? 'Gatunek z katalogu iNaturalist. Atlas nie ma zweryfikowanej informacji o jadalności tego gatunku.',
    habitat: local?.habitat ?? 'Sprawdź źródła eksperckie dla lokalnego siedliska.',
    photoUrl: taxon.default_photo?.medium_url,
    attribution: taxon.default_photo?.attribution,
    license: taxon.default_photo?.license_code,
    wikipediaUrl: taxon.wikipedia_url,
    local: Boolean(local),
  };
}
