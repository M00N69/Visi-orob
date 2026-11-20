export interface Family {
  id: string
  label: string
  color: string
}

export const FAMILIES: Family[] = [
  { id: 'micro', label: 'Microbiologie', color: '#2B8A6E' },
  { id: 'pesticides', label: 'Pesticides et métabolites', color: '#C2571A' },
  { id: 'pfas', label: 'PFAS', color: '#8B5CB8' },
  { id: 'metaux', label: 'Métaux et éléments traces', color: '#5F7186' },
  { id: 'nitrates', label: 'Nitrates et azote', color: '#2F6FB5' },
  { id: 'mineraux', label: 'Minéraux et physico-chimie', color: '#1E9AA8' },
  { id: 'organique', label: 'Solvants, HAP, PCB', color: '#B5376B' },
  { id: 'desinfection', label: 'Désinfection et sous-produits', color: '#A68A1F' },
  { id: 'organo', label: 'Aspect, odeur, saveur', color: '#8A9A3B' },
  { id: 'radio', label: 'Radioactivité', color: '#5B5FC7' },
  { id: 'autres', label: 'Autres paramètres', color: '#8C98A4' },
]

export const FAMILY_BY_ID: Record<string, Family> = Object.fromEntries(FAMILIES.map((f) => [f.id, f]))

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

// L'API ne fournit pas de « famille » de paramètres : on la déduit du libellé (et de l'unité).
// L'ordre des règles compte (ex. « chlorure de vinyle » doit passer avant « chlorures »).
const RULES: [string, RegExp][] = [
  ['pfas', /pfas|perfluor|pfoa|pfos|pfba|pfbs|pfhxa|pfhxs|pfhpa|pfna|pfda|pfunda|pfdoa|pftrda|pfpea|pfpes|fluorotelomere|\b6:2|\b8:2|genx|adona/],
  ['micro', /escherichia|e\. ?coli|coliformes|enterocoque|clostridium|bact\.|bacteri|germes|legionella|salmonella|pseudomonas|streptocoque|staphylocoque|virus|giardia|cryptosporidium|spores/],
  ['radio', /activite (alpha|beta)|tritium|radon|dose indicative|radium|radioactiv/],
  ['desinfection', /^chlore (libre|total|combine|residuel)|dioxyde de chlore|chlorite|chlorate|bromate|trihalomethane|bromoforme|chloroforme|dibromochloromethane|bromodichloromethane|\bthm\b|acides? haloacetiques/],
  ['organique', /benzene|trichloroethyl|tetrachloroethyl|chlorure de vinyle|dichloroethane|dichloromethane|\bhap\b|benzo|fluoranthene|indeno|\bpcb\b|hydrocarbure|toluene|xylene|styrene|naphtal|epichlorhydrine|acrylamide|bisphenol|\bcvm\b|tetrachloromethane|tetrachlorure/],
  ['pesticides', /pesticide|atrazine|simazine|glyphosate|\bampa\b|metolachlor|metazachlor|diuron|isoproturon|chlortoluron|terbuthylazine|propazine|desethyl|deisopropyl|metabolite|herbicide|fongicide|insecticide|carbendazime|imidaclopride|bentazone|2,4-d|\bmcpa\b|dimethenamide|flufenacet|acetochlor|alachlor|aclonifen|oxadixyl|tebuconazole|epoxiconazole|boscalid|azoxystrobine|prosulfocarbe|napropamide|chlorothalonil|lindane|\bddt\b|dieldrine|aldrine|heptachlor|\bhch\b|\besa\b|\bntl\b/],
  ['metaux', /arsenic|plomb|cuivre|nickel|cadmium|chrome|mercure|antimoine|selenium|aluminium|fer total|^fer\b|manganese|\bbore\b|zinc|baryum|argent|uranium|cobalt|vanadium|molybdene|cyanure/],
  ['nitrates', /nitrate|nitrite|ammonium|azote/],
  ['mineraux', /\bph\b|conductivite|durete|titre hydrotimetrique|titre alcalimetrique|calcium|magnesium|sodium|potassium|chlorures?\b|sulfate|fluorure|hydrogenocarbonate|bicarbonate|equilibre calco|temperature|silice|carbone organique|\bcot\b|oxydabilite|phosph|residu sec|mineralisation|carbonate|resistivite|agressivite|gaz carbonique|oxygene/],
  ['organo', /turbidite|couleur|odeur|saveur|aspect/],
]

export function classify(label: string, unit: string | null): string {
  const n = norm(label)
  for (const [id, re] of RULES) if (re.test(n)) return id
  // Dernier recours : un paramètre non reconnu exprimé en µg/L est le plus souvent une molécule de pesticide.
  if (unit && /^(µ|μ|u)g\/l$/i.test(unit.trim())) return 'pesticides'
  return 'autres'
}
