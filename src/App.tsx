import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchResults, type CommuneHit, type FetchResult } from './lib/api'
import { buildPvs, buildSeries, byGravity, coverage, lastExceedance } from './lib/analysis'
import { demoRows } from './lib/demo'
import { FAMILIES } from './lib/families'
import { iso10, monthsAgo } from './lib/format'
import { exportCsv, exportEcarts, exportPdf } from './lib/pdf'
import type { Place, Pv, Row } from './lib/types'
import { Barcode } from './components/Barcode'
import { Coverage } from './components/Coverage'
import { Evolution } from './components/Evolution'
import { Heatmap } from './components/Heatmap'
import { Network } from './components/Network'
import { SummaryBar, type StatusFilter } from './components/SummaryBar'
import { Timeline } from './components/Timeline'
import { Drawer } from './components/Drawer'
import { Picker } from './components/Picker'
import { PvTable } from './components/PvTable'

type Tab = 'pv' | 'heat' | '3d' | 'trend' | 'net' | 'coverage'

const Relief3D = lazy(() => import('./components/Relief3D'))

const NAV: [Tab, string, string][] = [
  ['pv', 'Procès-verbaux', '<path d="M6 3h9l4 4v14H6z M14 3v5h5 M9 12h7 M9 16h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'],
  ['heat', 'Heatmap', '<path d="M4 4h5v5H4z M10 4h5v5h-5z M16 4h4v5h-4z M4 10h5v5H4z M10 10h5v5h-5z M16 10h4v5h-4z M4 16h5v4H4z M10 16h5v4h-5z" fill="currentColor" opacity=".85"/>'],
  ['3d', 'Relief 3D', '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z M12 12l8-4.5 M12 12v9 M12 12L4 7.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'],
  ['trend', 'Évolution', '<path d="M3 17l5-6 4 4 8-9 M3 21h18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'],
  ['net', 'Réseaux', '<circle cx="5" cy="6" r="2.5" fill="currentColor"/><circle cx="5" cy="18" r="2.5" fill="currentColor"/><circle cx="19" cy="12" r="2.5" fill="currentColor"/><path d="M7 6.5c6 0 6 5.5 10 5.5 M7 17.5c6 0 6-5.5 10-5.5" fill="none" stroke="currentColor" stroke-width="1.8"/>'],
  ['coverage', 'Couverture des analyses', '<path d="M4 20V10 M10 20V4 M16 20v-8 M21 20H3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'],
]

const params = new URLSearchParams(window.location.search)
const DEMO = params.get('demo') === '1'

export default function App() {
  const today = iso10(new Date())
  const [region, setRegion] = useState('')
  const [dept, setDept] = useState('')
  const [commune, setCommune] = useState<Place | null>(() =>
    params.get('c') ? { code: params.get('c')!, name: params.get('n') ?? params.get('c')! } : DEMO ? { code: '00000', name: 'Commune démo' } : null,
  )
  const [from, setFrom] = useState(params.get('from') ?? monthsAgo(12))
  const [to, setTo] = useState(params.get('to') ?? today)

  const [rows, setRows] = useState<Row[]>([])
  const [meta, setMeta] = useState<Pick<FetchResult, 'announced' | 'requests' | 'checkUrl'> | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<[number, number]>([0, 0])
  const [error, setError] = useState('')

  const [tab, setTab] = useState<Tab>('pv')
  const [openId, setOpenId] = useState<string | null>(null)
  const [reseau, setReseau] = useState('')
  const [site, setSite] = useState('')
  const [fams, setFams] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<'date' | 'gravity'>('gravity')

  // Adresse partageable : la commune et la période sont dans l'URL.
  useEffect(() => {
    if (!commune || DEMO) return
    const p = new URLSearchParams({ c: commune.code, n: commune.name, from, to })
    window.history.replaceState(null, '', `?${p}`)
  }, [commune, from, to])

  const abort = useRef<AbortController | null>(null)
  const load = useCallback(async () => {
    if (!commune) return
    abort.current?.abort()
    const ctl = new AbortController()
    abort.current = ctl
    setLoading(true)
    setError('')
    setProgress([0, 0])
    setOpenId(null)
    try {
      if (DEMO) {
        const r = demoRows(from, to)
        setRows(r)
        setMeta({ announced: r.length, requests: 0, checkUrl: '' })
      } else {
        const res = await fetchResults(commune.code, from, to, (a, b) => setProgress([a, b]), ctl.signal)
        setRows(res.rows)
        setMeta({ announced: res.announced, requests: res.requests, checkUrl: res.checkUrl })
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setRows([])
      setMeta(null)
      setError(
        `${(e as Error).message}. Vérifiez votre connexion, puis relancez la recherche. Si le problème persiste, le service Hub'Eau est peut-être momentanément indisponible.`,
      )
    } finally {
      if (abort.current === ctl) setLoading(false)
    }
  }, [commune, from, to])

  useEffect(() => {
    void load()
    return () => abort.current?.abort()
  }, [load])

  const pick = (p: Place | null, hit?: CommuneHit) => {
    setCommune(p)
    setReseau('')
    setSite('')
    if (hit?.region) setRegion(hit.region.code)
    if (hit?.departement) setDept(hit.departement.code)
  }

  // Options de filtre calculées sur toutes les lignes reçues.
  const options = useMemo(() => {
    const res = new Map<string, string>()
    const sites = new Map<string, string>()
    for (const r of rows) {
      for (const x of r.reseaux ?? []) res.set(x.code, x.nom)
      if (r.code_installation_amont) sites.set(r.code_installation_amont, r.nom_installation_amont ?? r.code_installation_amont)
    }
    return { reseaux: [...res].sort((a, b) => a[1].localeCompare(b[1], 'fr')), sites: [...sites].sort((a, b) => a[1].localeCompare(b[1], 'fr')) }
  }, [rows])

  const allPvs = useMemo(() => buildPvs(rows), [rows])
  const presentFams = useMemo(() => FAMILIES.filter((f) => allPvs.some((p) => p.byFamily[f.id])), [allPvs])

  const pvs: Pv[] = useMemo(() => {
    const filtered = rows.filter(
      (r) =>
        (!site || r.code_installation_amont === site) &&
        (!reseau || (r.reseaux ?? []).some((x) => x.code === reseau)),
    )
    const all = buildPvs(filtered)
    if (!fams.size) return all
    // Filtre par famille : on ne garde que les PV qui la contiennent, et seulement ses lignes.
    return all
      .map((pv) => {
        const rs = pv.rows.filter((r) => fams.has(r.family))
        const byFamily: Record<string, number> = {}
        rs.forEach((r) => (byFamily[r.family] = (byFamily[r.family] ?? 0) + 1))
        return { ...pv, rows: rs, byFamily, nParams: rs.length, nLimit: rs.filter((r) => r.flag === 'limit').length, nRef: rs.filter((r) => r.flag === 'ref').length }
      })
      .filter((pv) => pv.rows.length)
  }, [rows, site, reseau, fams])

  const cov = useMemo(() => coverage(pvs), [pvs])
  const series = useMemo(() => buildSeries(pvs), [pvs])
  const last = useMemo(() => lastExceedance(pvs), [pvs])
  const shown = useMemo(() => {
    const l = status === 'all' ? pvs : pvs.filter((p) => p.verdict === status)
    return sort === 'gravity' ? [...l].sort(byGravity) : l
  }, [pvs, status, sort])
  const open = pvs.find((p) => p.id === openId) ?? null
  const ctx = { commune: commune?.name ?? '', from, to, demo: DEMO }

  const stats = useMemo(() => {
    const keys = new Set<string>()
    pvs.forEach((p) => p.rows.forEach((r) => keys.add(r.code_parametre)))
    return {
      n: pvs.length,
      ok: pvs.filter((p) => p.verdict === 'conforme').length,
      ref: pvs.filter((p) => p.verdict === 'reference').length,
      nc: pvs.filter((p) => p.verdict === 'non-conforme').length,
      params: keys.size,
      lines: pvs.reduce((a, p) => a + p.nParams, 0),
    }
  }, [pvs])

  const toggleFam = (id: string) =>
    setFams((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const received = rows.length
  const complete = meta ? received === meta.announced : false

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden>
            <path d="M16 3C16 3 6 14 6 20a10 10 0 0 0 20 0C26 14 16 3 16 3z" fill="currentColor" />
          </svg>
          <span>Eau potable · procès-verbaux</span>
        </div>
        <p className="top-sub">Résultats du contrôle sanitaire par commune : tous les types d'analyses, les résultats et les conclusions.</p>
      </header>

      {DEMO && <div className="demo-banner">Mode démonstration : données fictives générées localement. Retirez « ?demo=1 » de l'adresse pour interroger Hub'Eau.</div>}

      <main>
        <Picker
          region={region}
          dept={dept}
          commune={commune}
          from={from}
          to={to}
          onRegion={(c) => {
            setRegion(c)
            setDept('')
          }}
          onDept={setDept}
          onCommune={pick}
          onPeriod={(a, b) => {
            setFrom(a)
            setTo(b)
          }}
        />

        {!commune && (
          <section className="start">
            <h1>Choisissez une commune pour afficher ses procès-verbaux d'analyse.</h1>
            <p>
              Vous obtenez chaque prélèvement de la période avec sa conclusion sanitaire, la liste exacte des paramètres analysés (pesticides,
              PFAS, métaux, microbiologie…) et ce qui n'a pas été mesuré à chaque date. Les données viennent de l'API Hub'Eau, qui diffuse la
              base SISE-Eaux du ministère de la Santé.
            </p>
          </section>
        )}

        {commune && (
          <>
            <section className="result-head">
              <div>
                <h1>{commune.name}</h1>
                <p className="muted">
                  {loading
                    ? progress[1]
                      ? `Chargement… ${progress[0].toLocaleString('fr-FR')} lignes sur ${progress[1].toLocaleString('fr-FR')}`
                      : 'Chargement des résultats…'
                    : error
                      ? ''
                      : `${stats.n} prélèvement${stats.n > 1 ? 's' : ''} · ${stats.params} paramètres distincts`}
                </p>
              </div>
              {!loading && !error && pvs.length > 0 && (
                <div className="exports">
                  <button type="button" className="btn" onClick={() => exportPdf(ctx, pvs, { detail: true })}>
                    Rapport PDF complet
                  </button>
                  <button type="button" className="btn-quiet" onClick={() => exportEcarts(ctx, pvs, series)}>
                    PDF des écarts
                  </button>
                  <button type="button" className="btn-quiet" onClick={() => exportPdf(ctx, pvs, { detail: false })}>
                    Synthèse PDF
                  </button>
                  <button type="button" className="btn-quiet" onClick={() => exportCsv(ctx, pvs)}>
                    Export CSV
                  </button>
                </div>
              )}
            </section>

            {loading && <div className="loading" role="status"><span className="bar"><i style={{ width: progress[1] ? `${Math.min(100, (progress[0] / progress[1]) * 100)}%` : '8%' }} /></span></div>}

            {error && (
              <div className="alert" role="alert">
                <strong>Les résultats n'ont pas pu être chargés.</strong>
                <p>{error}</p>
                <button type="button" className="btn" onClick={() => void load()}>
                  Réessayer
                </button>
              </div>
            )}

            {!loading && !error && rows.length === 0 && (
              <div className="alert neutral">
                <strong>Aucun résultat pour cette commune sur la période.</strong>
                <p>
                  Hub'Eau publie les données avec environ un mois de décalage. Élargissez la période (par exemple 12 mois), ou vérifiez que la
                  commune est desservie par un réseau public. Certaines petites communes sont rattachées au réseau d'une commune voisine.
                </p>
              </div>
            )}

            {!loading && !error && rows.length > 0 && (
              <>
                <section className="source" aria-label="Contrôle de complétude des données">
                  <span className={complete ? 'dot ok' : 'dot bad'} />
                  <span>
                    {received.toLocaleString('fr-FR')} lignes reçues sur {meta?.announced.toLocaleString('fr-FR')} annoncées par Hub'Eau
                    {complete ? ' : jeu complet.' : ' : jeu incomplet, relancez la recherche.'}
                  </span>
                  {meta?.checkUrl && (
                    <a href={meta.checkUrl} target="_blank" rel="noreferrer">
                      Voir la réponse brute de l'API
                    </a>
                  )}
                </section>

                <section className="filters" aria-label="Filtres">
                  {options.sites.length > 1 && (
                    <label className="field">
                      <span>Installation de production</span>
                      <select value={site} onChange={(e) => setSite(e.target.value)}>
                        <option value="">Toutes ({options.sites.length})</option>
                        {options.sites.map(([c, n]) => (
                          <option key={c} value={c}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {options.reseaux.length > 1 && (
                    <label className="field">
                      <span>Réseau de distribution</span>
                      <select value={reseau} onChange={(e) => setReseau(e.target.value)}>
                        <option value="">Tous ({options.reseaux.length})</option>
                        {options.reseaux.map(([c, n]) => (
                          <option key={c} value={c}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className="field fam-filter">
                    <span>Types d'analyses {fams.size > 0 && <button type="button" className="link" onClick={() => setFams(new Set())}>tout afficher</button>}</span>
                    <div className="chips">
                      {presentFams.map((f) => (
                        <button key={f.id} type="button" className={fams.has(f.id) ? 'chip on' : 'chip'} onClick={() => toggleFam(f.id)} aria-pressed={fams.has(f.id)}>
                          <i style={{ background: f.color }} />
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                <SummaryBar stats={stats} active={status} onSelect={(s) => { setStatus(s); setTab('pv') }} last={last} onOpen={setOpenId} />

                <div className="layout">
                  <nav className="sidenav" role="tablist" aria-label="Vues">
                    {NAV.map(([id, label, icon]) => (
                      <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
                        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden dangerouslySetInnerHTML={{ __html: icon }} />
                        <span>{label}</span>
                        {id === 'pv' && stats.nc > 0 && <em className="nav-badge">{stats.nc}</em>}
                      </button>
                    ))}
                  </nav>
                  <div className="content">
                <section className="panel" role="tabpanel">
                  <h2 className="panel-title">{NAV.find((n) => n[0] === tab)?.[1]}</h2>
                  {tab === 'pv' && (
                    <div className="pv-tools">
                      <span className="muted small">
                        {shown.length} procès-verbal{shown.length > 1 ? 'aux' : ''} affiché{shown.length > 1 ? 's' : ''}
                        {status !== 'all' && (
                          <button type="button" className="link" onClick={() => setStatus('all')}>
                            tout afficher
                          </button>
                        )}
                      </span>
                      <label className="sort">
                        Trier par{' '}
                        <select value={sort} onChange={(e) => setSort(e.target.value as 'date' | 'gravity')}>
                          <option value="gravity">gravité (non conformes d'abord)</option>
                          <option value="date">date (récents d'abord)</option>
                        </select>
                      </label>
                    </div>
                  )}
                  {tab === 'pv' && pvs.length > 0 && (
                    <div className="tl-wrap">
                      <Timeline pvs={pvs} onOpen={setOpenId} />
                    </div>
                  )}
                  {tab === 'pv' && <PvTable pvs={shown} onOpen={setOpenId} onPdf={(pv) => exportPdf(ctx, [pv], { detail: true, filename: `pv-${pv.id}.pdf` })} />}
                  {tab === 'heat' && <Heatmap pvs={pvs} series={series} onOpen={setOpenId} />}
                  {tab === '3d' && (
                    <Suspense fallback={<p className="empty">Chargement de la vue 3D…</p>}>
                      <Relief3D pvs={pvs} series={series} onOpen={setOpenId} />
                    </Suspense>
                  )}
                  {tab === 'trend' && <Evolution series={series} onOpen={setOpenId} />}
                  {tab === 'net' && (
                    <Network
                      pvs={allPvs}
                      onPickSite={(c) => {
                        setSite(c)
                        setReseau('')
                        setTab('pv')
                      }}
                      onPickReseau={(c) => {
                        setReseau(c)
                        setSite('')
                        setTab('pv')
                      }}
                    />
                  )}
                  {tab === 'coverage' && (
                    <>
                      <p className="muted">Une colonne par prélèvement. Plus la case est foncée, plus la famille a été analysée en détail ; une case pâle signale une liste réduite.</p>
                      <Barcode pvs={pvs} cov={cov} onOpen={setOpenId} />
                      <Coverage pvs={pvs} cov={cov} onOpen={setOpenId} />
                    </>
                  )}
                </section>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </main>

      <footer>
        Source : Hub'Eau / SISE-Eaux, ministère chargé de la Santé, Licence Ouverte Etalab. Mise à jour mensuelle. Cette application compile des données
        ouvertes : elle ne remplace pas les bulletins d'analyse officiels des ARS.
      </footer>

      {open && <Drawer pv={open} series={series} onClose={() => setOpenId(null)} onPdf={(pv) => exportPdf(ctx, [pv], { detail: true, filename: `pv-${pv.id}.pdf` })} />}
    </div>
  )
}
