import { VERDICT_GLYPH, VERDICT_LABEL } from '../lib/analysis'
import type { Flag, Verdict } from '../lib/types'

export function VerdictBadge({ v, compact }: { v: Verdict; compact?: boolean }) {
  const text = compact && v === 'reference' ? 'Références dépassées' : VERDICT_LABEL[v]
  return (
    <span className={`badge badge-${v}`}>
      <i aria-hidden>{VERDICT_GLYPH[v]}</i>
      {text}
    </span>
  )
}

export function FlagMark({ f }: { f: Flag }) {
  if (f === 'limit') return <span className="flag flag-limit">✕ Limite dépassée</span>
  if (f === 'ref') return <span className="flag flag-ref">! Référence dépassée</span>
  if (f === 'lq') return <span className="flag flag-lq">&lt; seuil</span>
  return null
}

/** Classe de couleur d'un résultat rapporté à sa limite (en %). */
export const pctClass = (pct: number | null) =>
  pct === null ? 'p-none' : pct > 100 ? 'p-over' : pct >= 80 ? 'p-high' : pct >= 50 ? 'p-mid' : 'p-low'

/** Barre « résultat / limite » : le trait vertical marque 100 % de la limite. */
export function MarginBar({ pct }: { pct: number | null }) {
  if (pct === null) return null
  return (
    <span className={`mbar ${pctClass(pct)}`} title={`${Math.round(pct)} % de la limite`}>
      <span className="mbar-track">
        <i style={{ width: `${(Math.min(pct, 150) / 150) * 100}%` }} />
        <b aria-hidden />
      </span>
      <em>{Math.round(pct)} %</em>
    </span>
  )
}
