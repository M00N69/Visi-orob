import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Series } from '../lib/analysis'
import { fmtDate, fmtShort } from '../lib/format'
import type { Pv } from '../lib/types'

const MAX_PARAMS = 24
const SCALE = 6 // hauteur d'une barre à 100 % de la limite
const CELL = 1
const GAP = 0.22

const colorOf = (pct: number) => (pct > 100 ? 0xb42318 : pct >= 80 ? 0xf2a24a : pct >= 50 ? 0xe3d36a : 0x7fc4a0)

function label(text: string, opts: { color?: string; size?: number; align?: 'left' | 'right' | 'center' } = {}) {
  const size = opts.size ?? 44
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')!
  ctx.font = `600 ${size}px Figtree Variable, Segoe UI, sans-serif`
  const w = Math.ceil(ctx.measureText(text).width) + 16
  c.width = w
  c.height = size + 16
  ctx.font = `600 ${size}px Figtree Variable, Segoe UI, sans-serif`
  ctx.fillStyle = opts.color ?? '#10283a'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 8, c.height / 2)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }))
  const h = 0.55
  sp.scale.set((w / c.height) * h, h, 1)
  if (opts.align === 'right') sp.center.set(1, 0.5)
  else if (opts.align === 'left') sp.center.set(0, 0.5)
  return sp
}

interface Bar {
  pvId: string
  text: string
}

/** Relief 3D : prélèvements (x), paramètres (z), hauteur = résultat en % de la limite. Vue d'ensemble, à compléter par la heatmap pour la lecture précise. */
export default function Relief3D({ pvs, series, onOpen }: { pvs: Pv[]; series: Series[]; onOpen: (id: string) => void }) {
  const host = useRef<HTMLDivElement>(null)
  const resetRef = useRef<() => void>(() => {})
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null)
  const [fail, setFail] = useState(false)
  const openRef = useRef(onOpen)
  openRef.current = onOpen

  const cols = useMemo(() => [...pvs].sort((a, b) => a.ts - b.ts), [pvs])
  const rows = useMemo(
    () => series.filter((s) => s.pts.some((p) => p.pct !== null)).sort((a, b) => b.maxPct - a.maxPct || a.label.localeCompare(b.label, 'fr')).slice(0, MAX_PARAMS),
    [series],
  )

  useEffect(() => {
    const el = host.current
    if (!el || !cols.length || !rows.length) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      setFail(true)
      return
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    el.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400)
    const step = CELL + GAP
    const sx = cols.length * step
    const sz = rows.length * step
    const cx = sx / 2
    const cz = sz / 2

    scene.add(new THREE.AmbientLight(0xffffff, 0.75))
    const sun = new THREE.DirectionalLight(0xffffff, 1.1)
    sun.position.set(-sx * 0.4, 30, sz * 1.2)
    scene.add(sun)

    // Sol
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(sx + 2, sz + 2), new THREE.MeshBasicMaterial({ color: 0xe8eff2 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.set(cx - GAP / 2, -0.01, cz - GAP / 2)
    scene.add(floor)
    const grid = new THREE.GridHelper(Math.max(sx, sz) + 2, Math.max(cols.length, rows.length) + 2, 0xc3d3d9, 0xd8e3e7)
    grid.position.set(cx, 0, cz)
    scene.add(grid)

    // Plan de la limite à 100 %
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(sx + 2, sz + 2),
      new THREE.MeshBasicMaterial({ color: 0xb42318, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }),
    )
    plane.rotation.x = -Math.PI / 2
    plane.position.set(cx - GAP / 2, SCALE, cz - GAP / 2)
    scene.add(plane)
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(sx + 2, sz + 2)),
      new THREE.LineBasicMaterial({ color: 0xb42318 }),
    )
    edge.rotation.x = -Math.PI / 2
    edge.position.copy(plane.position)
    scene.add(edge)
    const lim = label('LIMITE (100 %)', { color: '#b42318', size: 40, align: 'left' })
    lim.position.set(sx + 1.2, SCALE, 0)
    scene.add(lim)

    // Barres
    const idx = new Map(cols.map((p, i) => [p.id, i]))
    const geo = new THREE.BoxGeometry(CELL, 1, CELL)
    const meshes: THREE.Mesh[] = []
    const info = new WeakMap<THREE.Object3D, Bar>()
    rows.forEach((s, j) => {
      for (const pt of s.pts) {
        if (pt.pct === null) continue
        const i = idx.get(pt.pvId)
        if (i === undefined) continue
        const h = Math.max(0.06, (pt.pct / 100) * SCALE)
        const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: colorOf(pt.pct) }))
        m.scale.y = h
        m.position.set(i * step, h / 2, j * step)
        scene.add(m)
        meshes.push(m)
        info.set(m, {
          pvId: pt.pvId,
          text: `${s.label} · ${fmtDate(pt.date)} · ${pt.value.toLocaleString('fr-FR')} ${s.unit} · ${Math.round(pt.pct)} % de la limite`,
        })
      }
    })

    // Étiquettes
    rows.forEach((s, j) => {
      const t = label(s.label.length > 30 ? s.label.slice(0, 29) + '…' : s.label, { align: 'right', size: 38 })
      t.position.set(-1, 0.05, j * step)
      scene.add(t)
    })
    const every = Math.max(1, Math.ceil(cols.length / 10))
    cols.forEach((p, i) => {
      if (i % every) return
      const t = label(fmtShort(p.ts), { align: 'center', size: 38 })
      t.position.set(i * step, 0.05, sz + 0.2)
      scene.add(t)
    })

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.maxPolarAngle = Math.PI / 2 - 0.03
    controls.autoRotate = !reduce
    controls.autoRotateSpeed = 0.7
    controls.target.set(cx, 1.5, cz)
    const R = Math.max(sx, sz)
    const home = () => {
      camera.position.set(cx - R * 0.25, R * 0.55 + 6, cz + R * 0.85 + 6)
      controls.target.set(cx, 1.5, cz)
      controls.update()
    }
    home()
    resetRef.current = () => {
      controls.autoRotate = false
      home()
    }
    controls.addEventListener('start', () => (controls.autoRotate = false))

    const resize = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    // Survol et clic
    const ray = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    let hover: THREE.Mesh | null = null
    let down: [number, number] | null = null
    const dom = renderer.domElement
    const pick = (e: PointerEvent) => {
      const r = dom.getBoundingClientRect()
      mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(mouse, camera)
      return { hit: ray.intersectObjects(meshes, false)[0]?.object as THREE.Mesh | undefined, r }
    }
    const setHover = (m: THREE.Mesh | null) => {
      if (hover === m) return
      if (hover) (hover.material as THREE.MeshLambertMaterial).emissive.setHex(0x000000)
      hover = m
      if (m) (m.material as THREE.MeshLambertMaterial).emissive.setHex(0x333333)
      dom.style.cursor = m ? 'pointer' : 'grab'
    }
    const onMove = (e: PointerEvent) => {
      const { hit, r } = pick(e)
      setHover(hit ?? null)
      setTip(hit ? { x: e.clientX - r.left, y: e.clientY - r.top, text: info.get(hit)!.text } : null)
    }
    const onDown = (e: PointerEvent) => (down = [e.clientX, e.clientY])
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return
      const { hit } = pick(e)
      if (hit) openRef.current(info.get(hit)!.pvId)
    }
    const onLeave = () => {
      setHover(null)
      setTip(null)
    }
    dom.addEventListener('pointermove', onMove)
    dom.addEventListener('pointerdown', onDown)
    dom.addEventListener('pointerup', onUp)
    dom.addEventListener('pointerleave', onLeave)

    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      controls.update()
      renderer.render(scene, camera)
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      dom.removeEventListener('pointermove', onMove)
      dom.removeEventListener('pointerdown', onDown)
      dom.removeEventListener('pointerup', onUp)
      dom.removeEventListener('pointerleave', onLeave)
      controls.dispose()
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose?.()
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        ;[mat].flat().forEach((x) => {
          if (!x) return
          ;(x as THREE.SpriteMaterial).map?.dispose()
          x.dispose()
        })
      })
      renderer.dispose()
      el.removeChild(dom)
    }
  }, [cols, rows])

  if (!rows.length) return <p className="empty">Aucun paramètre numérique avec limite ou référence à représenter.</p>
  if (fail) return <p className="empty">Votre navigateur ne permet pas l'affichage 3D (WebGL indisponible). Utilisez la Heatmap, qui présente les mêmes données.</p>

  return (
    <div className="relief">
      <p className="lead">
        Chaque barre est un résultat : sa hauteur est proportionnelle au <b>% de la limite</b> de qualité. Toute barre qui traverse le plan rouge dépasse la limite. Faites glisser pour
        tourner, molette pour zoomer, clic sur une barre pour ouvrir le procès-verbal. Vue d'ensemble : pour une lecture précise, utilisez la <b>Heatmap</b>.
      </p>
      <div className="relief-stage">
        <div ref={host} className="relief-canvas" role="img" aria-label="Relief 3D des résultats en pourcentage de la limite de qualité" />
        {tip && (
          <div className="relief-tip" style={{ left: tip.x + 14, top: tip.y + 14 }}>
            {tip.text}
          </div>
        )}
        <button type="button" className="btn-quiet relief-reset" onClick={() => resetRef.current()}>
          Recentrer la vue
        </button>
      </div>
      <p className="legend">
        <span className="lg p-low" /> moins de 50 % <span className="lg p-mid" /> 50 à 80 % <span className="lg p-high" /> 80 à 100 % <span className="lg p-over" /> au-dessus de la limite
        <span className="muted small"> · {rows.length} paramètres les plus proches de la limite, {cols.length} prélèvements</span>
      </p>
    </div>
  )
}
