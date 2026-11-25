import { classify, FAMILIES } from './families'
import type { Row } from './types'

/**
 * Recherche par paramètre dans les analyses.
 *
 * La saisie est découpée sur les virgules et points-virgules : chaque terme est
 * cherché indépendamment (OU). Un terme peut être :
 *  - un nom de paramètre (« atrazine », « plomb ») ;
 *  - un code paramètre SISE-Eaux (« 1382 ») ;
 *  - une famille (« PFAS », « pesticides », « métaux ») ;
 *  - un synonyme de famille (« herbicide », « perfluor »…).
 */
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

export interface SearchTerm {
  raw: string
  norm: string
}

export function parseQuery(q: string): SearchTerm[] {
  return q
    .split(/[,;]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((raw) => ({ raw, norm: norm(raw) }))
}

/** Synonymes de catégories : ils évitent d'écrire les libellés exacts des familles. */
const ALIASES: Record<string, string> = {
  perfluor: 'pfas',
  perfluores: 'pfas',
  herbicide: 'pesticides',
  fongicide: 'pesticides',
  insecticide: 'pesticides',
  'metaux lourds': 'metaux',
  'elements traces': 'metaux',
}

const FAMILY_LABEL = new Map(FAMILIES.map((f) => [f.id, norm(f.label)]))

type SearchableRow = Row & { family?: string }

/** Vrai si la ligne correspond à au moins un des termes (OU). */
export function rowMatches(r: SearchableRow, terms: SearchTerm[]): boolean {
  if (!terms.length) return true
  const label = norm(r.libelle_parametre)
  const code = norm(r.code_parametre ?? '')
  const fam = r.family ?? classify(r.libelle_parametre, r.libelle_unite)
  const famNorm = FAMILY_LABEL.get(fam) ?? fam
  return terms.some(({ norm: t }) => {
    if (!t) return false
    return (
      label.includes(t) ||
      code.includes(t) ||
      famNorm.includes(t) ||
      fam.includes(t) ||
      ALIASES[t] === fam
    )
  })
}
