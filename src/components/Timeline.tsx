import { VERDICT_LABEL } from '../lib/analysis'
import { fmtDateTime } from '../lib/format'
import type { Pv } from '../lib/types'

const COLOR = { conforme: '#2f8f5b', reference: '#b7791f', 'non-conforme': '#b42318', inconnu: '#8c98a4' }

/** Frise du temps : un repère par prélèvement, les non-conformes ressortent en rouge. */
export function Timeline({ pvs, onOpen }: { pvs: Pv[]; onOpen: (id: string) => void }) {
  if (!pvs.length) return null
  const sorted = [...pvs].sort((a, b) => a.ts - b.ts)
  const t0 = sorted[0].ts
  const t1 = sorted[sorted.length - 1].ts
  const W = 1000
  const L = 20
  const R = W - 20
  const x = (t: number) => (t1 === t0 ? (L + R) / 2 : L + ((t - t0) / (t1 - t0)) * (R - L))
  // Repères de mois
  const ticks: { x: number; label: string }[] = []
  const d = new Date(t0)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  d.setMonth(d.getMonth() + 1)
  const span = (t1 - t0) / (30 * 864e5)
  const step = span > 24 ? 6 : span > 12 ? 3 : span > 6 ? 2 : 1
  for (let i = 0; d.getTime() < t1; d.setMonth(d.getMonth() + 1), i++) {
    if (i % step === 0) ticks.push({ x: x(d.getTime()), label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }) })
  }
  const Y = 44
  return (
    <figure className="timeline">
      <svg viewBox={`0 0 ${W} 92`} role="img" aria-label="Frise chronologique des prélèvements, colorés selon la conclusion">
        <line x1={L} x2={R} y1={Y} y2={Y} stroke="#d3dfe3" strokeWidth="2" />
        {ticks.map((t) => (
          <g key={t.x}>
            <line x1={t.x} x2={t.x} y1={Y - 5} y2={Y + 5} stroke="#9fb3bb" />
            <text x={t.x} y={Y + 24} textAnchor="middle" className="axis">
              {t.label}
            </text>
          </g>
        ))}
        {sorted.map((p) => {
          const cx = x(p.ts)
          const bad = p.verdict === 'non-conforme'
          const ref = p.verdict === 'reference'
          return (
            <g key={p.id} className="pt" tabIndex={0} role="button" onClick={() => onOpen(p.id)} onKeyDown={(e) => e.key === 'Enter' && onOpen(p.id)}>
              <title>{`${fmtDateTime(p.date)} · ${VERDICT_LABEL[p.verdict]}${p.nLimit ? ` · ${p.nLimit} limite(s) dépassée(s)` : ''}`}</title>
              {bad ? (
                <>
                  <line x1={cx} x2={cx} y1={Y} y2={Y - 26} stroke={COLOR[p.verdict]} strokeWidth="2" />
                  <circle cx={cx} cy={Y - 30} r="9" fill={COLOR[p.verdict]} />
                  <text x={cx} y={Y - 26} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700">
                    ✕
                  </text>
                </>
              ) : ref ? (
                <path d={`M${cx} ${Y - 11} L${cx + 8} ${Y + 4} L${cx - 8} ${Y + 4} Z`} fill={COLOR[p.verdict]} />
              ) : (
                <circle cx={cx} cy={Y} r="5" fill={COLOR[p.verdict]} opacity={p.verdict === 'conforme' ? 0.6 : 1} />
              )}
            </g>
          )
        })}
      </svg>
      <figcaption className="legend">
        <span className="lg lg-ok" /> conforme <span className="lg lg-ref" /> référence dépassée (▲) <span className="lg lg-limit" /> non conforme (✕)
      </figcaption>
    </figure>
  )
}
