import { useMemo, useState } from 'react'
import type { Series } from '../lib/analysis'
import { FAMILY_BY_ID } from '../lib/families'
import { fmtDate, fmtShort } from '../lib/format'
import type { Pv } from '../lib/types'
import { pctClass } from './ui'

/** Carte de chaleur : paramètres en lignes, prélèvements en colonnes, couleur = résultat en % de la limite. */
export function Heatmap({ pvs, series, onOpen }: { pvs: Pv[]; series: Series[]; onOpen: (id: string) => void }) {
  const [all, setAll] = useState(false)
  const cols = useMemo(() => [...pvs].sort((a, b) => a.ts - b.ts), [pvs])
  const ranked = useMemo(() => series.filter((s) => s.pts.some((p) => p.pct !== null)).sort((a, b) => b.maxPct - a.maxPct || a.label.localeCompare(b.label, 'fr')), [series])
  const rows = all ? ranked : ranked.filter((s) => s.maxPct >= 50)
  const hidden = ranked.length - rows.length

  return (
    <div className="hm-wrap">
      <p className="lead">
        Chaque case est un résultat rapporté à sa limite de qualité (à défaut, à sa référence de qualité). Les paramètres les plus proches ou au-dessus de la limite sont
        en haut. Cliquez une case pour ouvrir le procès-verbal.
      </p>
      <div className="hm-tools">
        <label className="check">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
          Afficher aussi les paramètres très éloignés de la limite
        </label>
        {hidden > 0 && <span className="muted small">{hidden} paramètre(s) sous 50 % de la limite masqué(s)</span>}
      </div>
      {rows.length === 0 ? (
        <p className="empty">Aucun paramètre numérique avec limite ou référence sur cette sélection.</p>
      ) : (
        <div className="matrix-scroll hm-scroll">
          <table className="hm">
            <thead>
              <tr>
                <th className="sticky">Paramètre</th>
                {cols.map((p) => (
                  <th key={p.id} className={`hm-col verdict-${p.verdict}`}>
                    <button type="button" onClick={() => onOpen(p.id)} title={fmtDate(p.date)}>
                      {fmtShort(p.ts)}
                    </button>
                  </th>
                ))}
                <th className="cnt">Dépassements</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const byPv = new Map(s.pts.map((p) => [p.pvId, p]))
                const n = s.nLimit + s.nRef
                return (
                  <tr key={s.key}>
                    <th className="sticky">
                      <i style={{ background: FAMILY_BY_ID[s.family]?.color }} />
                      {s.label}
                      {s.unit && <small>{s.unit}</small>}
                    </th>
                    {cols.map((p) => {
                      const pt = byPv.get(p.id)
                      if (!pt) return <td key={p.id} className="hm-cell p-na" aria-label="non analysé" />
                      const cls = pctClass(pt.pct)
                      const txt = pt.pct === null ? '' : pt.pct > 100 ? '✕' : pt.pct >= 80 ? String(Math.round(pt.pct)) : ''
                      return (
                        <td
                          key={p.id}
                          className={`hm-cell ${cls}`}
                          title={`${s.label} · ${fmtDate(p.date)} · ${pt.value.toLocaleString('fr-FR')} ${s.unit}${pt.pct !== null ? ` · ${Math.round(pt.pct)} % de la limite` : ''}`}
                          onClick={() => onOpen(p.id)}
                        >
                          {txt}
                        </td>
                      )
                    })}
                    <td className={`cnt ${s.nLimit ? 'bad' : s.nRef ? 'warn' : ''}`}>{n ? `${n} / ${s.pts.length}` : '0'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="legend">
        <span className="lg p-low" /> moins de 50 % <span className="lg p-mid" /> 50 à 80 % <span className="lg p-high" /> 80 à 100 % (le nombre est affiché){' '}
        <span className="lg p-over" /> au-dessus de la limite (✕) <span className="lg p-na" /> non analysé
      </p>
    </div>
  )
}
