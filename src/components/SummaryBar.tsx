import { VERDICT_GLYPH, withUnit } from '../lib/analysis'
import { fmtDate } from '../lib/format'
import type { ParamRow, Pv, Verdict } from '../lib/types'

export type StatusFilter = Verdict | 'all'

interface Stats {
  n: number
  ok: number
  ref: number
  nc: number
}

/** Quatre tuiles cliquables : un clic filtre la liste des procès-verbaux. */
export function SummaryBar({
  stats,
  active,
  onSelect,
  last,
  onOpen,
}: {
  stats: Stats
  active: StatusFilter
  onSelect: (s: StatusFilter) => void
  last: { pv: Pv; row: ParamRow } | null
  onOpen: (id: string) => void
}) {
  const pct = (n: number) => (stats.n ? `${Math.round((n / stats.n) * 100)} %` : '')
  const tiles: { id: StatusFilter; label: string; n: number; cls: string; glyph: string }[] = [
    { id: 'all', label: 'Prélèvements', n: stats.n, cls: 't-all', glyph: '' },
    { id: 'conforme', label: 'Conformes', n: stats.ok, cls: 't-ok', glyph: VERDICT_GLYPH.conforme },
    { id: 'reference', label: 'Références dépassées', n: stats.ref, cls: 't-ref', glyph: VERDICT_GLYPH.reference },
    { id: 'non-conforme', label: 'Non conformes', n: stats.nc, cls: 't-bad', glyph: VERDICT_GLYPH['non-conforme'] },
  ]
  return (
    <section className="summary-bar" aria-label="Synthèse des conclusions">
      <div className="tiles">
        {tiles.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tile ${t.cls} ${t.n > 0 ? 'has' : ''} ${active === t.id ? 'on' : ''}`}
            aria-pressed={active === t.id}
            onClick={() => onSelect(active === t.id ? 'all' : t.id)}
          >
            <span className="tile-n">
              {t.glyph && <i aria-hidden>{t.glyph}</i>}
              {t.n}
            </span>
            <span className="tile-l">{t.label}</span>
            {t.id !== 'all' && <span className="tile-p">{pct(t.n)} des prélèvements</span>}
          </button>
        ))}
      </div>
      <p className={last ? 'last bad-line' : 'last ok-line'}>
        {last ? (
          <>
            <b>✕ Dernière limite dépassée :</b> {fmtDate(last.pv.date)} · {last.row.libelle_parametre} ({withUnit(last.row)}, limite {last.row.limite_qualite_parametre}) ·{' '}
            <button type="button" className="link" onClick={() => onOpen(last.pv.id)}>
              ouvrir le procès-verbal
            </button>
          </>
        ) : (
          <>
            <b>✓ Aucune limite de qualité dépassée</b> sur la période affichée.
          </>
        )}
      </p>
    </section>
  )
}
