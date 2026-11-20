import { useState } from 'react'
import { VERDICT_LABEL, ratioOf, withUnit } from '../lib/analysis'
import { fmtDate, fmtDateTime } from '../lib/format'
import type { Pv } from '../lib/types'
import { MarginBar, VerdictBadge } from './ui'

/** Écran d'accueil mobile : un verdict, les écarts, et rien d'autre. */
export function Essential({ pvs, nc, onOpen, onList }: { pvs: Pv[]; nc: number; onOpen: (id: string) => void; onList: () => void }) {
  const latest = [...pvs].sort((a, b) => b.ts - a.ts)[0]
  if (!latest) return <p className="empty">Aucun prélèvement.</p>
  const issues = latest.rows.filter((r) => r.flag === 'limit' || r.flag === 'ref').sort((a, b) => (a.flag === b.flag ? 0 : a.flag === 'limit' ? -1 : 1))
  const v = latest.verdict
  return (
    <div className="m-ess">
      <section className={`m-hero hero-${v}`}>
        <small>Dernier prélèvement · {fmtDate(latest.date)}</small>
        <strong>{VERDICT_LABEL[v]}</strong>
        <p>{latest.installation}</p>
        <p className="m-concl">{latest.conclusion}</p>
        <button type="button" className="btn" onClick={() => onOpen(latest.id)}>
          Ouvrir le procès-verbal
        </button>
      </section>

      <h2 className="m-h">{issues.length ? `Écarts constatés (${issues.length})` : 'Écarts constatés'}</h2>
      {issues.length === 0 ? (
        <p className="m-none">✓ Aucune limite ni référence dépassée sur ce prélèvement.</p>
      ) : (
        <ul className="m-issues">
          {issues.slice(0, 6).map((r, i) => {
            const ra = ratioOf(r)
            return (
              <li key={i} className={r.flag === 'limit' ? 'i-limit' : 'i-ref'}>
                <span className="i-name">
                  <i aria-hidden>{r.flag === 'limit' ? '✕' : '!'}</i>
                  {r.libelle_parametre}
                </span>
                <span className="m-val">
                  <b>{withUnit(r)}</b>
                  <em>{r.flag === 'limit' ? `limite ${r.limite_qualite_parametre}` : `référence ${r.reference_qualite_parametre}`}</em>
                </span>
                <MarginBar pct={ra ? ra.pct : null} />
              </li>
            )
          })}
        </ul>
      )}
      {issues.length > 6 && (
        <button type="button" className="btn-quiet m-more" onClick={() => onOpen(latest.id)}>
          Voir les {issues.length - 6} autres écarts
        </button>
      )}
      <p className="m-period">
        Sur la période : <b className={nc ? 'bad' : 'ok'}>{nc} prélèvement(s) non conforme(s)</b> sur {pvs.length}.
      </p>
      <button type="button" className="btn-quiet m-more" onClick={onList}>
        Voir tous les prélèvements
      </button>
    </div>
  )
}

/** Un prélèvement = une carte tactile. */
export function PvCards({ pvs, onOpen }: { pvs: Pv[]; onOpen: (id: string) => void }) {
  const [n, setN] = useState(8)
  if (!pvs.length) return <p className="empty">Aucun prélèvement ne correspond.</p>
  return (
    <div className="m-cards">
      {pvs.slice(0, n).map((pv) => (
        <button key={pv.id} type="button" className={`m-card v-${pv.verdict}`} onClick={() => onOpen(pv.id)}>
          <span className="m-card-top">
            <strong>{fmtDateTime(pv.date)}</strong>
            <VerdictBadge v={pv.verdict} compact />
          </span>
          <span className="m-card-sub">{pv.installation}</span>
          {pv.rows
            .filter((r) => r.flag === 'limit')
            .slice(0, 2)
            .map((r, i) => (
              <span key={i} className="exc">
                ✕ {r.libelle_parametre} <b>{withUnit(r)}</b> <em>(limite {r.limite_qualite_parametre})</em>
              </span>
            ))}
          {pv.nRef > 0 && pv.nLimit === 0 && <span className="m-ref">! {pv.nRef} référence(s) dépassée(s)</span>}
          <span className="m-chev" aria-hidden>
            ›
          </span>
        </button>
      ))}
      {pvs.length > n && (
        <button type="button" className="btn-quiet m-more" onClick={() => setN(n + 10)}>
          Voir plus ({pvs.length - n} restants)
        </button>
      )}
    </div>
  )
}
