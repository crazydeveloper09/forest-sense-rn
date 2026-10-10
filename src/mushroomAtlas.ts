export type EdibilityCategory = 'edible' | 'poisonous' | 'inedible';

export type AtlasSpecies = {
  scientificName: string;
  polishName: string;
  category: EdibilityCategory;
  description: string;
  habitat: string;
};

// Educational labels for a small Polish starter catalogue; not a foraging or consumption guide.
export const MUSHROOM_ATLAS: AtlasSpecies[] = [
  {
    scientificName: 'Boletus edulis',
    polishName: 'Borowik szlachetny',
    category: 'edible',
    description: 'Charakterystyczny borowik z jasną siateczką na trzonie. Podobne gatunki mogą być trudne do odróżnienia.',
    habitat: 'Lasy liściaste i iglaste',
  },
  {
    scientificName: 'Cantharellus cibarius',
    polishName: 'Pieprznik jadalny (kurka)',
    category: 'edible',
    description: 'Żółty grzyb z listewkami zbiegającymi na trzon. Możliwe są pomyłki z innymi żółtymi gatunkami.',
    habitat: 'Lasy liściaste i iglaste',
  },
  {
    scientificName: 'Imleria badia',
    polishName: 'Podgrzybek brunatny',
    category: 'edible',
    description: 'Brązowy borowikowaty, którego pory mogą sinieć po uciśnięciu.',
    habitat: 'Najczęściej lasy iglaste i mieszane',
  },
  {
    scientificName: 'Macrolepiota procera',
    polishName: 'Czubajka kania',
    category: 'edible',
    description: 'Duży grzyb z łuskowatym kapeluszem i ruchomym pierścieniem; młode okazy bywają mylone z muchomorami.',
    habitat: 'Polany, skraje lasów i łąki',
  },
  {
    scientificName: 'Leccinum versipelle',
    polishName: 'Koźlarz czerwony',
    category: 'edible',
    description: 'Koźlarz o pomarańczowym kapeluszu i ciemniejących łuskach na trzonie.',
    habitat: 'Zwykle pod osikami',
  },
  {
    scientificName: 'Amanita phalloides',
    polishName: 'Muchomor sromotnikowy',
    category: 'poisonous',
    description: 'Śmiertelnie trujący gatunek. Może być mylony z grzybami jadalnymi; sama fotografia nie wystarcza do bezpiecznego oznaczenia.',
    habitat: 'Lasy liściaste, często pod dębami i bukami',
  },
  {
    scientificName: 'Amanita muscaria',
    polishName: 'Muchomor czerwony',
    category: 'poisonous',
    description: 'Trujący muchomor z czerwonym kapeluszem i jasnymi łatkami.',
    habitat: 'Lasy, szczególnie w pobliżu brzóz i iglaków',
  },
  {
    scientificName: 'Galerina marginata',
    polishName: 'Hełmówka jadowita',
    category: 'poisonous',
    description: 'Śmiertelnie trujący, niewielki grzyb nadrzewny, który może przypominać jadalne gatunki rosnące na drewnie.',
    habitat: 'Martwe drewno drzew iglastych i liściastych',
  },
  {
    scientificName: 'Cortinarius orellanus',
    polishName: 'Zasłonak rudy',
    category: 'poisonous',
    description: 'Silnie trujący zasłonak. Objawy zatrucia mogą pojawić się z opóźnieniem.',
    habitat: 'Lasy liściaste, szczególnie dębowe',
  },
  {
    scientificName: 'Hypholoma fasciculare',
    polishName: 'Maślanka wiązkowa',
    category: 'poisonous',
    description: 'Gorzki i trujący grzyb rosnący zwykle w gęstych kępach na drewnie.',
    habitat: 'Pniaki i martwe drewno',
  },
  {
    scientificName: 'Tylopilus felleus',
    polishName: 'Goryczak żółciowy',
    category: 'inedible',
    description: 'Niejadalny, bardzo gorzki borowikowaty. Niekiedy mylony z borowikami.',
    habitat: 'Lasy liściaste i iglaste',
  },
  {
    scientificName: 'Paxillus involutus',
    polishName: 'Krowiak podwinięty',
    category: 'poisonous',
    description: 'Trujący gatunek mogący wywołać ciężkie zatrucie; nie należy go spożywać.',
    habitat: 'Lasy liściaste i iglaste',
  },
];

export function categoryLabel(category: EdibilityCategory): string {
  if (category === 'edible') return 'Tradycyjnie uznawany za jadalny';
  if (category === 'poisonous') return 'Trujący';
  return 'Niejadalny';
}
