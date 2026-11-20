import { useState } from 'react'
import { isLimited, type FamilyCoverage } from '../lib/analysis'
import { FAMILY_BY_ID, FAMILIES } from '../lib/families'
import { fmtShort } from '../lib/format'
import type { Pv } from '../lib/types'

/**
 * Pour chaque famille d'analyses : quels paramètres ont été mesurés, dans quels PV.
 * Répond à la question « a-t-on analysé toute la liste, ou seulement une partie ? ».
 */
export function Coverage({ pvs, cov, onOpen }: { pvs: Pv[]; cov: FamilyCoverage[]; onOpen: (id: string) => void }) {
  const cols = [...pvs].sort((a, b) => a.ts - b.ts)
  const ordered = FAMILIES.map((f) => cov.find((c) => c.family === f.id)).filter(Boolean) as FamilyCoverage[]
  const [open, setOpen] = useState<string | null>(ordered.find((c) => c.family === 'pesticides')?.family ?? ordered[0]?.family ?? null)
  const [partialOnly, setPartialOnly] = useState(false)

  if (!cols.length) return <p className="empty">Aucune donnée à afficher.</p>

  return (
    <div className="coverage">
      <p className="lead">
        Chaque famille d'analyses n'est pas mesurée de la même façon à chaque prélèvement. Ouvrez une famille pour voir, paramètre par
        paramètre, ce qui a été mesuré à chaque date.
      </p>
      {ordered.map((c) => {
        const fam = FAMILY_BY_ID[c.family]
        const isOpen = open === c.family
        const params = partialOnly ? c.params.filter((p) => p.measured.size < c.pvWith) : c.params
        const limitedPv = cols.filter((pv) => isLimited(c.perPv.get(pv.id) ?? 0, c.max)).length
        const absentPv = c.pvTotal - c.pvWith
        return (
          <section key={c.family} className={`cov-fam${isOpen ? ' open' : ''}`}>
            <button type="button" className="cov-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : c.family)}>
              <i style={{ background: fam.color }} />
              <strong>{fam.label}</strong>
              <span className="cov-stats">
                analysée dans <b>{c.pvWith}</b> PV sur {c.pvTotal}
                {c.max > 0 && (
                  <>
                    {' · '}
                    {c.min === c.max ? `${c.max} paramètre${c.max > 1 ? 's' : ''} à chaque fois` : `de ${c.min} à ${c.max} paramètres par PV`}
                  </>
                )}
                {' · '}
                {c.params.length} paramètre{c.params.length > 1 ? 's' : ''} distinct{c.params.length > 1 ? 's' : ''}
              </span>
              {limitedPv > 0 && <span className="tag tag-warn">{limitedPv} PV à liste réduite</span>}
              {absentPv > 0 && <span className="tag">{absentPv} PV sans cette famille</span>}
              <span className="chev" aria-hidden>
                {isOpen ? '−' : '+'}
              </span>
            </button>
            {isOpen && (
              <div className="cov-body">
                <label className="check">
                  <input type="checkbox" checked={partialOnly} onChange={(e) => setPartialOnly(e.target.checked)} />
                  Seulement les paramètres absents de certains PV
                </label>
                <div className="matrix-scroll">
                  <table className="matrix">
                    <thead>
                      <tr>
                        <th className="sticky">Paramètre</th>
                        {cols.map((pv) => (
                          <th key={pv.id} className="col" title={pv.installation}>
                            <button type="button" onClick={() => onOpen(pv.id)}>
                              {fmtShort(pv.ts)}
                            </button>
                          </th>
                        ))}
                        <th className="cnt">Mesuré</th>
                      </tr>
                    </thead>
                    <tbody>
                      {params.map((p) => (
                        <tr key={p.key}>
                          <th className="sticky" scope="row">
                            {p.label}
                            {p.unit && <small>{p.unit}</small>}
                          </th>
                          {cols.map((pv) => {
                            const r = p.measured.get(pv.id)
                            if (!r) return <td key={pv.id} className="m-none" title="Non mesuré dans ce prélèvement" />
                            return (
                              <td
                                key={pv.id}
                                className={`m-${r.flag}`}
                                title={`${fmtShort(pv.ts)} : ${r.display} ${r.libelle_unite ?? ''}`}
                                onClick={() => onOpen(pv.id)}
                              >
                                <span style={r.flag === 'ok' || r.flag === 'lq' ? { background: fam.color } : undefined} />
                              </td>
                            )
                          })}
                          <td className="cnt">
                            {p.measured.size}/{c.pvWith}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {params.length === 0 && <p className="empty">Tous les paramètres ont été mesurés à chaque prélèvement de cette famille.</p>}
                </div>
                <p className="legend">
                  <span className="lg lg-ok" style={{ background: fam.color }} /> mesuré
                  <span className="lg lg-ref" /> référence dépassée
                  <span className="lg lg-limit" /> limite dépassée
                  <span className="lg lg-none" /> non mesuré
                </p>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
