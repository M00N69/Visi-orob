import { useEffect, useMemo, useState } from 'react'
import { CONF_LABEL } from '../lib/analysis'
import { FAMILIES, FAMILY_BY_ID } from '../lib/families'
import { fmtDateTime } from '../lib/format'
import type { Pv } from '../lib/types'
import { FlagMark, VerdictBadge } from './ui'

export function Drawer({ pv, onClose, onPdf }: { pv: Pv; onClose: () => void; onPdf: (pv: Pv) => void }) {
  const [q, setQ] = useState('')
  const [onlyFlag, setOnlyFlag] = useState(false)

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return FAMILIES.map((f) => ({
      f,
      rows: pv.rows
        .filter((r) => r.family === f.id)
        .filter((r) => !needle || r.libelle_parametre.toLowerCase().includes(needle))
        .filter((r) => !onlyFlag || r.flag === 'limit' || r.flag === 'ref')
        .sort((a, b) => a.libelle_parametre.localeCompare(b.libelle_parametre, 'fr')),
    })).filter((g) => g.rows.length)
  }, [pv, q, onlyFlag])

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

          <div className="drawer-tools">
            <input type="search" placeholder="Chercher un paramètre (ex. nitrates, atrazine)" value={q} onChange={(e) => setQ(e.target.value)} />
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
