import { useEffect, useRef, useState } from 'react'
import { getDepartements, getDepartementsAll, getRegions, searchCommunes, type CommuneHit, type Region } from '../lib/api'
import { iso10, monthsAgo } from '../lib/format'
import type { Place } from '../lib/types'

interface Props {
  region: string
  dept: string
  commune: Place | null
  from: string
  to: string
  onRegion: (c: string) => void
  onDept: (c: string) => void
  onCommune: (p: Place | null, hit?: CommuneHit) => void
  onPeriod: (from: string, to: string) => void
}

const PRESETS = [
  { label: '3 mois', m: 3 },
  { label: '6 mois', m: 6 },
  { label: '12 mois', m: 12 },
  { label: '2 ans', m: 24 },
  { label: '5 ans', m: 60 },
]

export function Picker(p: Props) {
  const [regions, setRegions] = useState<Region[]>([])
  const [depts, setDepts] = useState<Region[]>([])
  const [geoError, setGeoError] = useState('')

  useEffect(() => {
    getRegions().then(setRegions).catch((e: Error) => setGeoError(e.message))
  }, [])
  useEffect(() => {
    const load = p.region ? getDepartements(p.region) : getDepartementsAll()
    load.then(setDepts).catch((e: Error) => setGeoError(e.message))
  }, [p.region])

  const today = iso10(new Date())
  const activePreset = PRESETS.find((x) => p.to === today && p.from === monthsAgo(x.m))

  return (
    <section className="picker" aria-label="Choix de la commune et de la période">
      <div className="picker-row">
        <label className="field">
          <span>Région</span>
          <select value={p.region} onChange={(e) => p.onRegion(e.target.value)}>
            <option value="">Toutes</option>
            {regions.map((r) => (
              <option key={r.code} value={r.code}>
                {r.nom}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Département</span>
          <select value={p.dept} onChange={(e) => p.onDept(e.target.value)}>
            <option value="">Tous</option>
            {depts.map((d) => (
              <option key={d.code} value={d.code}>
                {d.code} · {d.nom}
              </option>
            ))}
          </select>
        </label>
        <CommuneBox region={p.region} dept={p.dept} value={p.commune} onPick={p.onCommune} />
      </div>
      <div className="picker-row">
        <div className="field">
          <span>Période des prélèvements</span>
          <div className="period">
            <input type="date" aria-label="Du" value={p.from} max={p.to} onChange={(e) => p.onPeriod(e.target.value, p.to)} />
            <span aria-hidden>au</span>
            <input type="date" aria-label="Au" value={p.to} min={p.from} max={today} onChange={(e) => p.onPeriod(p.from, e.target.value)} />
          </div>
        </div>
        <div className="presets" role="group" aria-label="Périodes rapides">
          {PRESETS.map((x) => (
            <button
              key={x.m}
              type="button"
              className={activePreset?.m === x.m ? 'chip on' : 'chip'}
              onClick={() => p.onPeriod(monthsAgo(x.m), today)}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>
      {geoError && <p className="note warn">Liste des régions indisponible ({geoError}). Vous pouvez quand même chercher une commune par son nom.</p>}
    </section>
  )
}

function CommuneBox({
  region,
  dept,
  value,
  onPick,
}: {
  region: string
  dept: string
  value: Place | null
  onPick: (p: Place | null, hit?: CommuneHit) => void
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [hits, setHits] = useState<CommuneHit[]>([])
  const [busy, setBusy] = useState(false)
  const [cursor, setCursor] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQ(value?.name ?? '')
  }, [value])

  useEffect(() => {
    if (!open) return
    const query = q === value?.name ? '' : q
    if (!query && !dept && !region) {
      setHits([])
      return
    }
    setBusy(true)
    const t = setTimeout(() => {
      searchCommunes(query, dept, region)
        .then((h) => {
          setHits(h)
          setCursor(0)
        })
        .catch(() => setHits([]))
        .finally(() => setBusy(false))
    }, 220)
    return () => clearTimeout(t)
  }, [q, open, dept, region, value])

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const choose = (h: CommuneHit) => {
    onPick({ code: h.code, name: h.name }, h)
    setQ(h.name)
    setOpen(false)
  }

  return (
    <div className="field field-commune" ref={boxRef}>
      <label htmlFor="commune-input">
        <span>Commune</span>
      </label>
      <input
        id="commune-input"
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls="commune-list"
        autoComplete="off"
        placeholder="Tapez un nom de commune"
        value={q}
        onFocus={(e) => {
          setOpen(true)
          e.currentTarget.select()
        }}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setCursor((c) => Math.min(c + 1, hits.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setCursor((c) => Math.max(c - 1, 0))
          } else if (e.key === 'Enter' && hits[cursor]) {
            e.preventDefault()
            choose(hits[cursor])
          } else if (e.key === 'Escape') setOpen(false)
        }}
      />
      {open && (
        <ul id="commune-list" className="combo" role="listbox">
          {busy && <li className="combo-empty">Recherche…</li>}
          {!busy && hits.length === 0 && (
            <li className="combo-empty">{q || dept || region ? 'Aucune commune trouvée' : 'Commencez à taper ou choisissez un département'}</li>
          )}
          {hits.map((h, i) => (
            <li
              key={h.code}
              role="option"
              aria-selected={i === cursor}
              className={i === cursor ? 'on' : ''}
              onMouseEnter={() => setCursor(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(h)
              }}
            >
              <strong>{h.name}</strong>
              <span>{h.departement ? `${h.departement.code} · ${h.departement.nom}` : h.code}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
