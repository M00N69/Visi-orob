import { useMemo, useState } from 'react'
import { parseBounds, type Series } from '../lib/analysis'
import { FAMILY_BY_ID } from '../lib/families'
import { fmtDate, fmtNum, fmtShort } from '../lib/format'

const COL = { limit: '#b42318', ref: '#b7791f', lq: '#8c98a4', ok: '#0f7c86' }

/** Un paramètre dans le temps, avec sa limite (rouge) et sa référence (orange). */
export function Evolution({ series, onOpen }: { series: Series[]; onOpen: (id: string) => void }) {
  const list = useMemo(
    () => [...series].sort((a, b) => b.nLimit - a.nLimit || b.nRef - a.nRef || b.maxPct - a.maxPct || a.label.localeCompare(b.label, 'fr')),
    [series],
  )
  const [key, setKey] = useState('')
  const s = list.find((x) => x.key === key) ?? list[0]
  if (!s) return <p className="empty">Aucun paramètre numérique à représenter.</p>

  const lim = parseBounds(s.limit)
  const ref = parseBounds(s.ref)
  const vals = s.pts.map((p) => p.value)
  const marks = [lim?.max, lim?.min, ref?.max, ref?.min].filter((v): v is number => v !== undefined)
  let lo = Math.min(0, ...vals, ...(lim?.min !== undefined ? [lim.min] : []))
  let hi = Math.max(...vals, ...marks.filter((m) => m <= Math.max(...vals) * 6 || m === lim?.max))
  if (hi === lo) hi = lo + 1
  const pad = (hi - lo) * 0.1
  hi += pad
  if (lo < 0) lo -= pad

  const W = 900
  const H = 340
  const ml = 56
  const mr = 24
  const mt = 16
  const mb = 40
  const t0 = s.pts[0].ts
  const t1 = s.pts[s.pts.length - 1].ts
  const x = (t: number) => (t1 === t0 ? (ml + W - mr) / 2 : ml + ((t - t0) / (t1 - t0)) * (W - ml - mr))
  const y = (v: number) => mt + (1 - (v - lo) / (hi - lo)) * (H - mt - mb)
  const yTicks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4)
  const line = s.pts.map((p) => `${x(p.ts)},${y(p.value)}`).join(' ')
  const nOver = s.nLimit + s.nRef

  return (
    <div className="trend">
      <div className="trend-tools">
        <label className="field">
          <span>Paramètre (classés : dépassements d'abord)</span>
          <select value={s.key} onChange={(e) => setKey(e.target.value)}>
            {list.map((p) => (
              <option key={p.key} value={p.key}>
                {p.nLimit + p.nRef > 0 ? '✕ ' : ''}
                {p.label}
                {p.unit ? ` (${p.unit})` : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className={nOver ? 'recur bad-line' : 'recur ok-line'}>
        <i style={{ background: FAMILY_BY_ID[s.family]?.color }} />
        <b>{s.label}</b> :{' '}
        {nOver ? (
          <>
            {s.nLimit > 0 && <strong>{s.nLimit} limite(s) dépassée(s)</strong>}
            {s.nLimit > 0 && s.nRef > 0 && ' et '}
            {s.nRef > 0 && <strong>{s.nRef} référence(s) dépassée(s)</strong>} sur {s.pts.length} mesure(s) de la période.
          </>
        ) : (
          <>aucun dépassement sur {s.pts.length} mesure(s) de la période.</>
        )}
      </p>

      <figure className="chart">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Évolution de ${s.label}`}>
          {yTicks.map((v) => (
            <g key={v}>
              <line className="grid" x1={ml} x2={W - mr} y1={y(v)} y2={y(v)} />
              <text className="axis" x={ml - 8} y={y(v) + 4} textAnchor="end">
                {fmtNum(Number(v.toPrecision(3)))}
              </text>
            </g>
          ))}
          {lim?.max !== undefined && (
            <>
              <rect x={ml} y={mt} width={W - ml - mr} height={Math.max(0, y(lim.max) - mt)} fill="#fbe7e4" opacity="0.7" />
              <line className="limit" x1={ml} x2={W - mr} y1={y(lim.max)} y2={y(lim.max)} />
              <text className="limit-label" x={W - mr} y={y(lim.max) - 6} textAnchor="end">
                Limite {s.limit}
              </text>
            </>
          )}
          {lim?.min !== undefined && <line className="limit" x1={ml} x2={W - mr} y1={y(lim.min)} y2={y(lim.min)} />}
          {ref?.max !== undefined && <line className="refline" x1={ml} x2={W - mr} y1={y(ref.max)} y2={y(ref.max)} />}
          {ref?.max !== undefined && (
            <text className="ref-label" x={ml + 6} y={y(ref.max) - 6}>
              Référence {s.ref}
            </text>
          )}
          {ref?.min !== undefined && <line className="refline" x1={ml} x2={W - mr} y1={y(ref.min)} y2={y(ref.min)} />}
          <polyline points={line} fill="none" stroke="#9fb3bb" strokeWidth="1.5" />
          {s.pts.map((p) => {
            const bad = p.flag === 'limit'
            return (
              <g key={p.pvId} className="pt" tabIndex={0} role="button" onClick={() => onOpen(p.pvId)} onKeyDown={(e) => e.key === 'Enter' && onOpen(p.pvId)}>
                <title>{`${fmtDate(p.date)} · ${fmtNum(p.value)} ${s.unit}${p.pct !== null ? ` · ${Math.round(p.pct)} % de la limite` : ''} · ${p.installation}`}</title>
                <circle cx={x(p.ts)} cy={y(p.value)} r={bad ? 8 : 5.5} fill={COL[p.flag]} stroke="#fff" strokeWidth="2" />
                {bad && (
                  <text x={x(p.ts)} y={y(p.value) + 3.5} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700">
                    ✕
                  </text>
                )}
              </g>
            )
          })}
          <text className="axis" x={ml} y={H - 10}>
            {fmtShort(t0)}
          </text>
          <text className="axis" x={W - mr} y={H - 10} textAnchor="end">
            {fmtShort(t1)}
          </text>
        </svg>
        <figcaption>
          <span>
            Unité : <b>{s.unit || '—'}</b>
          </span>
          <span className="legend-series">
            <span>
              <i style={{ background: COL.ok }} />
              conforme
            </span>
            <span>
              <i style={{ background: COL.ref }} />
              référence dépassée
            </span>
            <span>
              <i style={{ background: COL.limit }} />
              limite dépassée (✕)
            </span>
            <span>
              <i style={{ background: COL.lq }} />
              &lt; seuil
            </span>
          </span>
        </figcaption>
      </figure>
    </div>
  )
}
