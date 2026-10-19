export const TRAIT_QUESTIONS = [
  {
    id: 'underside',
    prompt: 'Co widać pod kapeluszem?',
    options: [
      { id: 'A', label: 'Blaszki' },
      { id: 'B', label: 'Rurki' },
      { id: 'C', label: 'Kolce' },
      { id: 'D', label: 'Gładki spód albo brak kapelusza' },
    ],
  },
  {
    id: 'cap',
    prompt: 'Jaki kształt ma kapelusz?',
    options: [
      { id: 'A', label: 'Wypukły' },
      { id: 'B', label: 'Płaski' },
      { id: 'C', label: 'Lejkowaty' },
      { id: 'D', label: 'Kulisty albo jeszcze zamknięty' },
    ],
  },
  {
    id: 'stem',
    prompt: 'Co widać na trzonie?',
    options: [
      { id: 'A', label: 'Pierścień' },
      { id: 'B', label: 'Pochwę u podstawy' },
      { id: 'C', label: 'Trzon gładki, bez pierścienia i pochwy' },
      { id: 'D', label: 'Trzonu nie widać' },
    ],
  },
  {
    id: 'place',
    prompt: 'Gdzie rósł grzyb?',
    options: [
      { id: 'A', label: 'W lesie iglastym' },
      { id: 'B', label: 'W lesie liściastym' },
      { id: 'C', label: 'Na drewnie albo pniu' },
      { id: 'D', label: 'Na łące, trawniku albo polu' },
    ],
  },
] as const;

export type TraitId = (typeof TRAIT_QUESTIONS)[number]['id'];
export type TraitChoice = 'A' | 'B' | 'C' | 'D';
export type TraitAnswers = Partial<Record<TraitId, TraitChoice>>;
