import { VERDICT_LABEL } from '../lib/analysis'
import type { Flag, Verdict } from '../lib/types'

export function VerdictBadge({ v, compact }: { v: Verdict; compact?: boolean }) {
  const text = compact && v === 'reference' ? 'Références dépassées' : VERDICT_LABEL[v]
  return (
    <span className={`badge badge-${v}`}>
      <i aria-hidden />
      {text}
    </span>
  )
}

export function FlagMark({ f }: { f: Flag }) {
  if (f === 'limit') return <span className="flag flag-limit">Limite dépassée</span>
  if (f === 'ref') return <span className="flag flag-ref">Référence dépassée</span>
  if (f === 'lq') return <span className="flag flag-lq">&lt; seuil</span>
  return null
}
