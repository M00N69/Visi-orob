import { classify } from './families'
import { fmtNum } from './format'
import type { Flag, ParamRow, Pv, Row, Verdict } from './types'

/** Lit une limite du type « <=50 », « >=6,5 et <=9 » ou « [6.5 - 9] ». */
export function parseBounds(s?: string | null): { min?: number; max?: number } | null {
  if (!s) return null
  const t = s.replace(/,/g, '.').replace(/\s/g, '')
  let min: number | undefined
  let max: number | undefined
  let found = false
  for (const m of t.matchAll(/(<=|>=|≤|≥|<|>)(\d+(?:\.\d+)?)/g)) {
    const v = parseFloat(m[2])
    if (m[1].startsWith('<') || m[1] === '≤') max = v
    else min = v
    found = true
  }
  if (!found) {
    const r = t.match(/^\[?(\d+(?:\.\d+)?)[-–;](\d+(?:\.\d+)?)\]?$/)
    if (r) {
      min = parseFloat(r[1])
      max = parseFloat(r[2])
      found = true
    }
  }
  return found ? { min, max } : null
}

function exceeds(v: number, b: { min?: number; max?: number } | null): boolean {
  if (!b) return false
  return (b.max !== undefined && v > b.max) || (b.min !== undefined && v < b.min)
}

export function toParamRow(r: Row): ParamRow {
  const alpha = r.resultat_alphanumerique?.trim() ?? null
  const belowLq = alpha !== null && alpha.startsWith('<')
  const value = !belowLq && r.resultat_numerique !== null && r.resultat_numerique !== undefined ? r.resultat_numerique : null
  let flag: Flag = 'ok'
  if (belowLq) flag = 'lq'
  else if (value !== null) {
    if (exceeds(value, parseBounds(r.limite_qualite_parametre))) flag = 'limit'
    else if (exceeds(value, parseBounds(r.reference_qualite_parametre))) flag = 'ref'
  }
  const display = alpha && alpha !== '' ? alpha : value !== null ? fmtNum(value) : '—'
  return { ...r, family: classify(r.libelle_parametre, r.libelle_unite), flag, value, display }
}

function verdictOf(r: Row): Verdict {
  const a = [r.conformite_limites_bact_prelevement, r.conformite_limites_pc_prelevement]
  const b = [r.conformite_references_bact_prelevement, r.conformite_references_pc_prelevement]
  if (a.includes('N')) return 'non-conforme'
  if (b.includes('N')) return 'reference'
  if (a.includes('C') || b.includes('C')) return 'conforme'
  const t = (r.conclusion_conformite_prelevement ?? '').toLowerCase()
  if (/non conforme/.test(t)) return 'non-conforme'
  if (/conforme/.test(t)) return 'conforme'
  return 'inconnu'
}

export function buildPvs(rows: Row[]): Pv[] {
  const map = new Map<string, Pv>()
  for (const raw of rows) {
    const pr = toParamRow(raw)
    let pv = map.get(raw.code_prelevement)
    if (!pv) {
      pv = {
        id: raw.code_prelevement,
        date: raw.date_prelevement,
        ts: new Date(raw.date_prelevement).getTime(),
        installation: raw.nom_installation_amont ?? 'Installation non précisée',
        installationCode: raw.code_installation_amont ?? '',
        distributeur: raw.nom_distributeur ?? '',
        reseaux: (raw.reseaux ?? []).map((x) => ({ code: x.code, nom: x.nom })),
        conclusion: raw.conclusion_conformite_prelevement ?? 'Conclusion non renseignée',
        conf: {
          limBact: raw.conformite_limites_bact_prelevement ?? '',
          limPc: raw.conformite_limites_pc_prelevement ?? '',
          refBact: raw.conformite_references_bact_prelevement ?? '',
          refPc: raw.conformite_references_pc_prelevement ?? '',
        },
        verdict: verdictOf(raw),
        rows: [],
        byFamily: {},
        nParams: 0,
        nLimit: 0,
        nRef: 0,
      }
      map.set(pv.id, pv)
    }
    pv.rows.push(pr)
    pv.byFamily[pr.family] = (pv.byFamily[pr.family] ?? 0) + 1
    pv.nParams += 1
    if (pr.flag === 'limit') pv.nLimit += 1
    if (pr.flag === 'ref') pv.nRef += 1
  }
  return [...map.values()].sort((a, b) => b.ts - a.ts)
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  conforme: 'Conforme',
  reference: 'Conforme aux limites, références dépassées',
  'non-conforme': 'Non conforme',
  inconnu: 'Non évalué',
}

export const CONF_LABEL = (c: string) => (c === 'C' ? 'Conforme' : c === 'N' ? 'Non conforme' : c === 'S' ? 'Sans objet' : c ? c : 'Non renseigné')

export interface FamilyCoverage {
  family: string
  pvWith: number
  pvTotal: number
  min: number
  max: number
  perPv: Map<string, number>
  params: {
    key: string
    label: string
    unit: string
    measured: Map<string, ParamRow>
  }[]
}

/** Pour chaque famille : dans quels PV a-t-elle été analysée, et avec quels paramètres. */
export function coverage(pvs: Pv[]): FamilyCoverage[] {
  const byFam = new Map<string, FamilyCoverage>()
  for (const pv of pvs) {
    for (const r of pv.rows) {
      let fc = byFam.get(r.family)
      if (!fc) {
        fc = { family: r.family, pvWith: 0, pvTotal: pvs.length, min: 0, max: 0, perPv: new Map(), params: [] }
        byFam.set(r.family, fc)
      }
      fc.perPv.set(pv.id, (fc.perPv.get(pv.id) ?? 0) + 1)
      const key = r.code_parametre || r.libelle_parametre
      let p = fc.params.find((x) => x.key === key)
      if (!p) {
        p = { key, label: r.libelle_parametre, unit: r.libelle_unite ?? '', measured: new Map() }
        fc.params.push(p)
      }
      p.measured.set(pv.id, r)
    }
  }
  for (const fc of byFam.values()) {
    const counts = [...fc.perPv.values()]
    fc.pvWith = counts.length
    fc.max = Math.max(...counts)
    fc.min = Math.min(...counts)
    fc.params.sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  }
  return [...byFam.values()]
}

/** Un PV est « limité » pour une famille s'il contient moins de la moitié des paramètres du PV le plus complet. */
export function isLimited(count: number, max: number): boolean {
  return max >= 4 && count > 0 && count < max * 0.5
}

/* ---------- Résultat rapporté à la limite, séries par paramètre, récurrence ---------- */

export interface Ratio {
  /** Résultat en % de la limite de qualité (à défaut, de la référence). Plafonné à 200. */
  pct: number
  kind: 'limit' | 'ref'
  bound: string
}

export function ratioOf(r: ParamRow): Ratio | null {
  if (r.value === null) return null
  const lim = parseBounds(r.limite_qualite_parametre)
  const ref = parseBounds(r.reference_qualite_parametre)
  const b = lim ?? ref
  if (!b) return null
  const v = r.value
  const parts: number[] = []
  if (b.max !== undefined) parts.push(b.max > 0 ? v / b.max : v > 0 ? 2 : 0)
  if (b.min !== undefined) parts.push(v > 0 ? b.min / v : 2)
  if (!parts.length) return null
  return {
    pct: Math.min(200, Math.max(...parts) * 100),
    kind: lim ? 'limit' : 'ref',
    bound: (lim ? r.limite_qualite_parametre : r.reference_qualite_parametre) ?? '',
  }
}

export const paramKey = (r: Row) => r.code_parametre || r.libelle_parametre

export interface SeriesPoint {
  pvId: string
  ts: number
  date: string
  value: number
  flag: Flag
  pct: number | null
  installation: string
}

export interface Series {
  key: string
  label: string
  unit: string
  family: string
  pts: SeriesPoint[]
  nLimit: number
  nRef: number
  maxPct: number
  limit: string
  ref: string
}

/** Une série par paramètre ayant au moins un résultat numérique. */
export function buildSeries(pvs: Pv[]): Series[] {
  const map = new Map<string, Series>()
  for (const pv of [...pvs].sort((a, b) => a.ts - b.ts)) {
    for (const r of pv.rows) {
      if (r.value === null) continue
      const key = paramKey(r)
      let s = map.get(key)
      if (!s) {
        s = { key, label: r.libelle_parametre, unit: r.libelle_unite ?? '', family: r.family, pts: [], nLimit: 0, nRef: 0, maxPct: 0, limit: '', ref: '' }
        map.set(key, s)
      }
      const ra = ratioOf(r)
      s.pts.push({ pvId: pv.id, ts: pv.ts, date: pv.date, value: r.value, flag: r.flag, pct: ra ? ra.pct : null, installation: pv.installation })
      if (r.flag === 'limit') s.nLimit += 1
      if (r.flag === 'ref') s.nRef += 1
      if (ra && ra.pct > s.maxPct) s.maxPct = ra.pct
      if (r.limite_qualite_parametre) s.limit = r.limite_qualite_parametre
      if (r.reference_qualite_parametre) s.ref = r.reference_qualite_parametre
    }
  }
  return [...map.values()]
}

/** Dernier prélèvement avec une limite dépassée, et le premier paramètre concerné. */
export function lastExceedance(pvs: Pv[]): { pv: Pv; row: ParamRow } | null {
  const pv = pvs.filter((p) => p.nLimit > 0).sort((a, b) => b.ts - a.ts)[0]
  if (!pv) return null
  return { pv, row: pv.rows.find((r) => r.flag === 'limit')! }
}

const GRAVITY: Record<Verdict, number> = { 'non-conforme': 0, reference: 1, inconnu: 2, conforme: 3 }
export const byGravity = (a: Pv, b: Pv) => GRAVITY[a.verdict] - GRAVITY[b.verdict] || b.nLimit - a.nLimit || b.ts - a.ts

export const VERDICT_GLYPH: Record<Verdict, string> = { conforme: '✓', reference: '!', 'non-conforme': '✕', inconnu: '?' }

/** Texte « 52 mg/L ». */
export const withUnit = (r: ParamRow) => `${r.display}${r.libelle_unite ? ' ' + r.libelle_unite : ''}`
