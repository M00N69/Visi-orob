import { FAMILIES } from '../lib/families'
import { fmtDate, fmtShort } from '../lib/format'
import { isLimited, type FamilyCoverage } from '../lib/analysis'
import type { Pv } from '../lib/types'

/**
 * Une colonne par procès-verbal (du plus ancien au plus récent), une ligne par famille d'analyses.
 * L'intensité de la case indique combien de paramètres de la famille ont été analysés ce jour-là :
 * on voit d'un coup d'œil les PV « complets » et les PV « limités ».
 */
export function Barcode({ pvs, cov, onOpen }: { pvs: Pv[]; cov: FamilyCoverage[]; onOpen: (id: string) => void }) {
  const cols = [...pvs].sort((a, b) => a.ts - b.ts)
  const rows = FAMILIES.filter((f) => cov.some((c) => c.family === f.id))
  if (!cols.length) return null
  return (
    <div className="barcode" role="figure" aria-label="Types d'analyses réalisées pour chaque procès-verbal">
      <div className="bc-labels">
        <div className="bc-head" />
        {rows.map((f) => {
          const c = cov.find((x) => x.family === f.id)!
          return (
            <div key={f.id} className="bc-label" title={f.label}>
              <i style={{ background: f.color }} />
              <span>{f.label}</span>
              <em>
                {c.pvWith}/{c.pvTotal}
              </em>
            </div>
          )
        })}
      </div>
      <div className="bc-scroll">
        <div className="bc-grid" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(14px, 1fr))` }}>
          {cols.map((pv) => (
            <button
              key={pv.id}
              type="button"
              className={`bc-col verdict-${pv.verdict}`}
              onClick={() => onOpen(pv.id)}
              aria-label={`Prélèvement du ${fmtDate(pv.date)}, ${pv.nParams} paramètres`}
              title={`${fmtDate(pv.date)} · ${pv.installation} · ${pv.nParams} paramètres`}
            >
              <span className="bc-flag" />
              {rows.map((f) => {
                const c = cov.find((x) => x.family === f.id)!
                const n = pv.byFamily[f.id] ?? 0
                const level = n ? 0.28 + 0.72 * Math.min(1, n / Math.max(1, c.max)) : 0
                return (
                  <span
                    key={f.id}
                    className={`bc-cell${isLimited(n, c.max) ? ' limited' : ''}`}
                    style={n ? { background: f.color, opacity: level } : undefined}
                  />
                )
              })}
            </button>
          ))}
        </div>
        <div className="bc-axis">
          <span>{fmtShort(cols[0].ts)}</span>
          <span>{fmtShort(cols[cols.length - 1].ts)}</span>
        </div>
      </div>
    </div>
  )
}
