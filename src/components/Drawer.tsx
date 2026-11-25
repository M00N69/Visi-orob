import { useEffect, useMemo, useState } from 'react'
import { CONF_LABEL, paramKey, ratioOf, withUnit, type Series } from '../lib/analysis'
import { FAMILIES, FAMILY_BY_ID } from '../lib/families'
import { parseQuery, rowMatches } from '../lib/search'
import { fmtDateTime } from '../lib/format'
import type { Pv } from '../lib/types'
import { FlagMark, MarginBar, VerdictBadge } from './ui'

export function Drawer({ pv, series, onClose, onPdf }: { pv: Pv; series: Series[]; onClose: () => void; onPdf: (pv: Pv) => void }) {
  const hist = useMemo(() => new Map(series.map((s) => [s.key, s])), [series])
  const issues = useMemo(
    () => pv.rows.filter((r) => r.flag === 'limit' || r.flag === 'ref').sort((a, b) => (a.flag === b.flag ? 0 : a.flag === 'limit' ? -1 : 1)),
    [pv],
  )
  const [q, setQ] = useState('')
  const [onlyFlag, setOnlyFlag] = useState(false)
  const terms = useMemo(() => parseQuery(q), [q])

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const groups = useMemo(() => {
    return FAMILIES.map((f) => ({
      f,
      rows: pv.rows
        .filter((r) => r.family === f.id)
        .filter((r) => rowMatches(r, terms))
        .filter((r) => !onlyFlag || r.flag === 'limit' || r.flag === 'ref')
        .sort((a, b) => a.libelle_parametre.localeCompare(b.libelle_parametre, 'fr')),
    })).filter((g) => g.rows.length)
  }, [pv, terms, onlyFlag])

  const confs = [
    ['Limites bactériologiques', pv.conf.limBact],
    ['Limites physico-chimiques', pv.conf.limPc],
    ['Références bactériologiques', pv.conf.refBact],
    ['Références physico-chimiques', pv.conf.refPc],
  ]

  return (
    <div className="drawer-wrap">
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Détail du procès-verbal">
        <header>
          <div>
            <h2>Prélèvement du {fmtDateTime(pv.date)}</h2>
            <p className="muted">
              {pv.installation}
              {pv.distributeur && ` · ${pv.distributeur}`} · réf. {pv.id}
            </p>
          </div>
          <div className="drawer-actions">
            <button type="button" className="btn" onClick={() => onPdf(pv)}>
              Télécharger le PDF
            </button>
            <button type="button" className="btn-quiet" onClick={onClose} aria-label="Fermer">
              Fermer
            </button>
          </div>
        </header>

        <div className="drawer-body">
          <section className="conclusion">
            <VerdictBadge v={pv.verdict} />
            <p>{pv.conclusion}</p>
            <dl className="confs">
              {confs.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd className={v === 'N' ? 'bad' : v === 'C' ? 'ok' : ''}>{CONF_LABEL(v)}</dd>
                </div>
              ))}
            </dl>
            {pv.reseaux.length > 0 && (
              <p className="muted small">Réseaux concernés : {pv.reseaux.map((r) => r.nom).join(' · ')}</p>
            )}
          </section>

          {issues.length > 0 && (
            <section className="issues" aria-label="Écarts constatés">
              <h3>Écarts constatés ({issues.length})</h3>
              <ul>
                {issues.map((r, i) => {
                  const h = hist.get(paramKey(r))
                  const n = h ? h.nLimit + h.nRef : 0
                  const ra = ratioOf(r)
                  return (
                    <li key={i} className={r.flag === 'limit' ? 'i-limit' : 'i-ref'}>
                      <span className="i-name">
                        <i aria-hidden>{r.flag === 'limit' ? '✕' : '!'}</i>
                        {r.libelle_parametre}
                      </span>
                      <span className="i-val">
                        <b>{withUnit(r)}</b> <em>{r.flag === 'limit' ? `limite ${r.limite_qualite_parametre}` : `référence ${r.reference_qualite_parametre}`}</em>
                      </span>
                      <MarginBar pct={ra ? ra.pct : null} />
                      {h && n > 1 && (
                        <span className="i-rec">
                          Récurrent : {n} dépassement(s) sur {h.pts.length} mesure(s) de la période
                        </span>
                      )}
                      {h && n === 1 && h.pts.length > 1 && <span className="i-rec solo">Cas isolé sur la période ({h.pts.length} mesures)</span>}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          <div className="drawer-tools">
            <input type="search" placeholder="Chercher un paramètre ou une catégorie (ex. nitrates, atrazine, PFAS)" value={q} onChange={(e) => setQ(e.target.value)} />
            <label className="check">
              <input type="checkbox" checked={onlyFlag} onChange={(e) => setOnlyFlag(e.target.checked)} />
              Dépassements seulement
            </label>
          </div>

          <p className="muted small">Les mentions « limite dépassée » et « référence dépassée » sont calculées par l'application à partir des seuils fournis avec chaque résultat. La conclusion du procès-verbal ci-dessus fait foi.</p>

          {groups.length === 0 && <p className="empty">Aucun paramètre ne correspond.</p>}
          {groups.map(({ f, rows }) => (
            <section key={f.id} className="param-group">
              <h3>
                <i style={{ background: FAMILY_BY_ID[f.id].color }} />
                {f.label} <span>{rows.length}</span>
              </h3>
              <table className="params">
                <thead>
                  <tr>
                    <th>Paramètre</th>
                    <th className="num">Résultat</th>
                    <th>Unité</th>
                    <th>Limite</th>
                    <th>Référence</th>
                    <th>Marge</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.code_parametre + i} className={`row-${r.flag}`}>
                      <td>{r.libelle_parametre}</td>
                      <td className="num">{r.display}</td>
                      <td>{r.libelle_unite}</td>
                      <td>{r.limite_qualite_parametre}</td>
                      <td>{r.reference_qualite_parametre}</td>
                      <td>
                        <MarginBar pct={ratioOf(r)?.pct ?? null} />
                      </td>
                      <td>
                        <FlagMark f={r.flag} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      </aside>
    </div>
  )
}
