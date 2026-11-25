import { withUnit } from '../lib/analysis'
import { FAMILIES } from '../lib/families'
import { fmtDateTime } from '../lib/format'
import type { Pv } from '../lib/types'
import { VerdictBadge } from './ui'

export function PvTable({ pvs, onOpen, onPdf, searching = false }: { pvs: Pv[]; onOpen: (id: string) => void; onPdf: (pv: Pv) => void; searching?: boolean }) {
  if (!pvs.length) return <p className="empty">Aucun procès-verbal ne correspond à ces filtres.</p>
  return (
    <table className="pv-table">
      <thead>
        <tr>
          <th>Prélèvement</th>
          <th>Installation</th>
          <th>Analyses réalisées</th>
          <th>Conclusion</th>
          <th aria-label="Actions" />
        </tr>
      </thead>
      <tbody>
        {pvs.map((pv) => (
          <tr key={pv.id} className={`v-${pv.verdict}`} onClick={() => onOpen(pv.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen(pv.id)}>
            <td className="nowrap">
              <strong>{fmtDateTime(pv.date)}</strong>
              <small>{pv.id}</small>
            </td>
            <td>
              {pv.installation}
              {pv.reseaux.length > 1 && <small>{pv.reseaux.length} réseaux alimentés</small>}
            </td>
            <td>
              <div className="fam-line">
                <b>{pv.nParams} paramètres</b>
                {FAMILIES.filter((f) => pv.byFamily[f.id]).map((f) => (
                  <span key={f.id} className="fam-chip" title={f.label}>
                    <i style={{ background: f.color }} />
                    {shortLabel(f.id)} {pv.byFamily[f.id]}
                  </span>
                ))}
              </div>
              {searching && (
                <small className="matched">{pv.rows.map((r) => r.libelle_parametre).slice(0, 4).join(' · ')}</small>
              )}
            </td>
            <td>
              <VerdictBadge v={pv.verdict} compact />
              <small className="concl-text">{pv.conclusion}</small>
              {pv.nLimit > 0 && <small className="bad">✕ {pv.nLimit} limite(s) dépassée(s)</small>}
              {pv.rows
                .filter((r) => r.flag === 'limit')
                .slice(0, 3)
                .map((r, i) => (
                  <span key={i} className="exc">
                    {r.libelle_parametre} <b>{withUnit(r)}</b> <em>(limite {r.limite_qualite_parametre})</em>
                  </span>
                ))}
              {pv.nRef > 0 && <small className="warn">! {pv.nRef} référence(s) dépassée(s)</small>}
            </td>
            <td className="actions">
              <button
                type="button"
                className="btn-quiet"
                onClick={(e) => {
                  e.stopPropagation()
                  onPdf(pv)
                }}
              >
                PDF
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const SHORT: Record<string, string> = {
  micro: 'Micro',
  pesticides: 'Pesticides',
  pfas: 'PFAS',
  metaux: 'Métaux',
  nitrates: 'Azote',
  mineraux: 'Physico-chimie',
  organique: 'Solvants',
  desinfection: 'Désinfection',
  organo: 'Aspect',
  radio: 'Radio',
  autres: 'Autres',
}
const shortLabel = (id: string) => SHORT[id] ?? id
