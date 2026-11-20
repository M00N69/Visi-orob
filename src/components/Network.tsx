import { useMemo } from 'react'
import { VERDICT_GLYPH, VERDICT_LABEL } from '../lib/analysis'
import { fmtDate } from '../lib/format'
import type { Pv, Verdict } from '../lib/types'

const COLOR: Record<Verdict, string> = { conforme: '#2f8f5b', reference: '#b7791f', 'non-conforme': '#b42318', inconnu: '#8c98a4' }

interface Node {
  code: string
  name: string
  verdict: Verdict
  last: number
  nc: number
  n: number
}

/**
 * Schéma des installations de production (à gauche) et des réseaux de distribution qu'elles alimentent (à droite).
 * Chaque élément prend la couleur de son dernier prélèvement ; un clic filtre la liste sur cet élément.
 */
export function Network({ pvs, onPickSite, onPickReseau }: { pvs: Pv[]; onPickSite: (code: string) => void; onPickReseau: (code: string) => void }) {
  const { sites, reseaux, links } = useMemo(() => {
    const sites = new Map<string, Node>()
    const reseaux = new Map<string, Node>()
    const links = new Map<string, { s: string; r: string; verdict: Verdict; ts: number }>()
    const upd = (m: Map<string, Node>, code: string, name: string, pv: Pv) => {
      let n = m.get(code)
      if (!n) m.set(code, (n = { code, name, verdict: pv.verdict, last: 0, nc: 0, n: 0 }))
      n.n += 1
      if (pv.verdict === 'non-conforme') n.nc += 1
      if (pv.ts >= n.last) {
        n.last = pv.ts
        n.verdict = pv.verdict
      }
    }
    for (const pv of pvs) {
      const sc = pv.installationCode || pv.installation
      upd(sites, sc, pv.installation, pv)
      for (const r of pv.reseaux) {
        upd(reseaux, r.code, r.nom, pv)
        const k = `${sc}|${r.code}`
        const l = links.get(k)
        if (!l || pv.ts >= l.ts) links.set(k, { s: sc, r: r.code, verdict: pv.verdict, ts: pv.ts })
      }
    }
    const sort = (a: Node, b: Node) => b.nc - a.nc || a.name.localeCompare(b.name, 'fr')
    return { sites: [...sites.values()].sort(sort), reseaux: [...reseaux.values()].sort(sort), links: [...links.values()] }
  }, [pvs])

  if (!sites.length) return <p className="empty">Aucune installation à représenter.</p>

  const RH = 58
  const GAP = 12
  const W = 900
  const NW = 330
  const rows = Math.max(sites.length, reseaux.length)
  const H = rows * (RH + GAP) + GAP
  const pos = (i: number, n: number) => GAP + i * (RH + GAP) + ((rows - n) * (RH + GAP)) / 2
  const sy = new Map(sites.map((n, i) => [n.code, pos(i, sites.length) + RH / 2]))
  const ry = new Map(reseaux.map((n, i) => [n.code, pos(i, reseaux.length) + RH / 2]))

  const card = (n: Node, x: number, y: number, onClick: () => void) => (
    <g key={x + n.code} className="pt" tabIndex={0} role="button" onClick={onClick} onKeyDown={(e) => e.key === 'Enter' && onClick()}>
      <title>{`${n.name} · dernier prélèvement : ${fmtDate(new Date(n.last).toISOString())} (${VERDICT_LABEL[n.verdict]}) · ${n.nc} non conforme(s) sur ${n.n}`}</title>
      <rect x={x} y={y} width={NW} height={RH} rx="10" fill="#fff" stroke={COLOR[n.verdict]} strokeWidth={n.verdict === 'non-conforme' ? 3 : 1.5} />
      <rect x={x} y={y} width="8" height={RH} rx="4" fill={COLOR[n.verdict]} />
      <circle cx={x + 30} cy={y + RH / 2} r="12" fill={COLOR[n.verdict]} />
      <text x={x + 30} y={y + RH / 2 + 4.5} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700">
        {VERDICT_GLYPH[n.verdict]}
      </text>
      <text x={x + 52} y={y + 24} fontSize="14" fontWeight="650" fill="#10283a">
        {n.name.length > 34 ? n.name.slice(0, 33) + '…' : n.name}
      </text>
      <text x={x + 52} y={y + 43} fontSize="12" fill="#47606f">
        {VERDICT_LABEL[n.verdict]} · {n.nc} non conforme(s) / {n.n}
      </text>
    </g>
  )

  return (
    <div className="net">
      <p className="lead">
        Schéma de l'alimentation en eau : quelle installation de production alimente quel réseau. Les couleurs reprennent la conclusion du <b>dernier prélèvement</b> de
        chaque élément. Ce n'est pas une carte géographique (l'API ne fournit pas de coordonnées) ; cliquez un élément pour filtrer les procès-verbaux.
      </p>
      <figure className="chart">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Schéma des installations et des réseaux">
          {links.map((l) => {
            const x1 = NW
            const x2 = W - NW
            const a = sy.get(l.s)!
            const b = ry.get(l.r)!
            return <path key={l.s + l.r} d={`M${x1} ${a} C${(x1 + x2) / 2} ${a},${(x1 + x2) / 2} ${b},${x2} ${b}`} fill="none" stroke={COLOR[l.verdict]} strokeWidth={l.verdict === 'non-conforme' ? 3 : 1.8} opacity="0.75" strokeDasharray={l.verdict === 'reference' ? '6 4' : undefined} />
          })}
          {sites.map((n, i) => card(n, 0, pos(i, sites.length), () => onPickSite(n.code)))}
          {reseaux.map((n, i) => card(n, W - NW, pos(i, reseaux.length), () => onPickReseau(n.code)))}
        </svg>
        <figcaption>
          <span>
            <b>Installations de production</b> à gauche · <b>réseaux de distribution</b> à droite
          </span>
        </figcaption>
      </figure>
    </div>
  )
}
