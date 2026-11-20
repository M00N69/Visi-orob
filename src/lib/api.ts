import type { Place, Row } from './types'

const HUBEAU = 'https://hubeau.eaufrance.fr/api/v1/qualite_eau_potable/resultats_dis'
const GEO = 'https://geo.api.gouv.fr'

const FIELDS = [
  'code_prelevement',
  'date_prelevement',
  'code_parametre',
  'libelle_parametre',
  'resultat_alphanumerique',
  'resultat_numerique',
  'libelle_unite',
  'limite_qualite_parametre',
  'reference_qualite_parametre',
  'conclusion_conformite_prelevement',
  'conformite_limites_bact_prelevement',
  'conformite_limites_pc_prelevement',
  'conformite_references_bact_prelevement',
  'conformite_references_pc_prelevement',
  'nom_distributeur',
  'nom_installation_amont',
  'code_installation_amont',
  'nom_commune',
  'code_lieu_analyse',
  'reference_analyse',
  'reseaux',
].join(',')

/** Hub'Eau limite la profondeur d'une requête à 20 000 lignes (page × taille). */
export const MAX_ROWS = 20000

export interface FetchResult {
  rows: Row[]
  /** Nombre de lignes annoncé par Hub'Eau (somme des fenêtres de dates interrogées). */
  announced: number
  /** Nombre de requêtes de pagination effectuées. */
  requests: number
  /** URL d'une requête équivalente pour la période entière, à ouvrir pour comparer à la main. */
  checkUrl: string
}

const day = 86400000
const utc = (s: string) => new Date(s + 'T00:00:00Z').getTime()
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)

const url = (code: string, from: string, to: string, extra: string) =>
  `${HUBEAU}?code_commune=${code}&date_min_prelevement=${from}&date_max_prelevement=${to}&sort=desc${extra}`

interface Page {
  count: number
  next: string | null
  data: Row[]
}

async function getPage(u: string, signal: AbortSignal): Promise<Page> {
  const res = await fetch(u, { signal })
  if (!res.ok) throw Object.assign(new Error(`Hub'Eau a répondu ${res.status}`), { status: res.status })
  return (await res.json()) as Page
}

/**
 * Récupère toutes les lignes entre deux dates. Si la fenêtre contient plus de 20 000 lignes
 * (cas des grandes villes), elle est coupée en deux, récursivement : aucune ligne n'est perdue.
 */
export async function fetchResults(
  code: string,
  from: string,
  to: string,
  onProgress: (received: number, announced: number) => void,
  signal: AbortSignal,
): Promise<FetchResult> {
  const rows: Row[] = []
  let announced = 0
  let requests = 0
  let size = 5000

  const window = async (a: string, b: string): Promise<void> => {
    let page: Page
    try {
      page = await getPage(url(code, a, b, `&fields=${FIELDS}&size=${size}`), signal)
    } catch (e) {
      // Taille de page refusée : on réessaie avec des pages plus petites.
      if ((e as { status?: number }).status === 400 && size > 1000) {
        size = 1000
        page = await getPage(url(code, a, b, `&fields=${FIELDS}&size=${size}`), signal)
      } else throw e
    }
    requests++
    if (page.count > MAX_ROWS && a < b) {
      const mid = iso(Math.floor((utc(a) + utc(b)) / 2 / day) * day)
      await window(a, mid)
      await window(iso(utc(mid) + day), b)
      return
    }
    announced += page.count
    rows.push(...page.data)
    onProgress(rows.length, announced)
    let next = page.next
    while (next) {
      const p = await getPage(next, signal)
      requests++
      rows.push(...p.data)
      onProgress(rows.length, announced)
      next = p.next
    }
  }

  await window(from, to)

  // Filtre de sécurité côté navigateur (la requête est déjà filtrée par Hub'Eau).
  const f = utc(from)
  const t = utc(to) + day - 1
  const kept = rows.filter((r) => {
    const ts = new Date(r.date_prelevement).getTime()
    return ts >= f && ts <= t
  })
  return { rows: kept, announced, requests, checkUrl: url(code, from, to, '&size=100') }
}

export interface Region {
  code: string
  nom: string
}

const cache = new Map<string, unknown>()
async function geo<T>(path: string): Promise<T> {
  if (cache.has(path)) return cache.get(path) as T
  const res = await fetch(GEO + path)
  if (!res.ok) throw new Error(`geo.api.gouv.fr a répondu ${res.status}`)
  const json = (await res.json()) as T
  cache.set(path, json)
  return json
}

export const getRegions = () => geo<Region[]>('/regions').then((r) => [...r].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')))
export const getDepartements = (codeRegion: string) =>
  geo<Region[]>(`/departements?codeRegion=${codeRegion}`).then((r) => [...r].sort((a, b) => a.code.localeCompare(b.code)))
export const getDepartementsAll = () => geo<Region[]>('/departements').then((r) => [...r].sort((a, b) => a.code.localeCompare(b.code)))

export interface CommuneHit extends Place {
  departement?: Region
  region?: Region
}

export async function searchCommunes(q: string, codeDepartement: string, codeRegion: string): Promise<CommuneHit[]> {
  const p = new URLSearchParams({ fields: 'nom,code,departement,region', limit: '60' })
  if (codeDepartement) p.set('codeDepartement', codeDepartement)
  else if (codeRegion) p.set('codeRegion', codeRegion)
  if (q.trim()) {
    p.set('nom', q.trim())
    p.set('boost', 'population')
  }
  const list = await geo<{ nom: string; code: string; departement?: Region; region?: Region }[]>(`/communes?${p}`)
  const hits = list.map((c) => ({ code: c.code, name: c.nom, departement: c.departement, region: c.region }))
  return q.trim() ? hits : hits.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}
