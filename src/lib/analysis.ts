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
