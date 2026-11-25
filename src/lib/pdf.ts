import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { CONF_LABEL, VERDICT_LABEL } from './analysis'
import { FAMILY_BY_ID } from './families'
import { fmtDate, fmtDateTime, fmtShort } from './format'
import { ratioOf, type Series } from './analysis'
import type { Pv } from './types'

export interface PdfContext {
  commune: string
  from: string
  to: string
  demo: boolean
  /** Recherche de paramètre active, reprise dans l'en-tête des exports. */
  q?: string
}

// Helvetica (police PDF standard) ne gère pas toute l'Unicode : on remplace les rares caractères hors Latin-1.
const s = (t: string | null | undefined) =>
  (t ?? '')
    .replace(/[  ]/g, ' ')
    .replace(/[≤]/g, '<=')
    .replace(/[≥]/g, '>=')
    .replace(/[–—]/g, '-')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/µ/g, 'µ')

const INK: [number, number, number] = [16, 40, 58]
const TEAL: [number, number, number] = [15, 124, 134]

const STATUS = { limit: 'Limite dépassée', ref: 'Référence dépassée', lq: '< seuil de quantification', ok: '' }

function addFooters(doc: jsPDF, M: number) {
  const W = doc.internal.pageSize.getWidth()
  const now = new Date().toISOString()
  const n = doc.getNumberOfPages()
  const H = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    doc.setFontSize(7.5)
    doc.setTextColor(110, 125, 138)
    doc.text(
      s(
        "Source : Hub'Eau / SISE-Eaux, ministère chargé de la Santé (Licence Ouverte Etalab). Compilation de données ouvertes : elle ne remplace pas les bulletins d'analyse officiels des ARS.",
      ),
      M,
      H - 40,
      { maxWidth: W - 2 * M },
    )
    doc.text(s(`Extrait le ${fmtDateTime(now)}`), M, H - 14)
    doc.text(`${i} / ${n}`, W - M, H - 14, { align: 'right' })
  }

}

export function exportPdf(ctx: PdfContext, pvs: Pv[], opts: { detail: boolean; filename?: string }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 40
  const sorted = [...pvs].sort((a, b) => a.ts - b.ts)

  // Bandeau de titre
  doc.setFillColor(...INK)
  doc.rect(0, 0, W, 86, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(s(sorted.length === 1 ? `Procès-verbal d'analyse du ${fmtDate(sorted[0].date)}` : "Contrôle sanitaire de l'eau potable"), M, 40)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(s(`${ctx.commune} - période du ${fmtDate(ctx.from)} au ${fmtDate(ctx.to)}${ctx.q ? ` - recherche : ${ctx.q}` : ''}`), M, 62)
  if (ctx.demo) {
    doc.setTextColor(255, 200, 120)
    doc.text('DONNÉES DE DÉMONSTRATION - SANS VALEUR', W - M, 62, { align: 'right' })
  }

  // Synthèse
  const nNc = sorted.filter((p) => p.verdict === 'non-conforme').length
  const nRef = sorted.filter((p) => p.verdict === 'reference').length
  const nLim = sorted.reduce((a, p) => a + p.nLimit, 0)
  doc.setTextColor(...INK)
  doc.setFontSize(11)
  const lines = [
    `${sorted.length} procès-verbal(aux) de prélèvement sur la période.`,
    `${sorted.length - nNc - nRef} conforme(s), ${nRef} avec références de qualité dépassées, ${nNc} non conforme(s).`,
    `${nLim} résultat(s) au-dessus d'une limite de qualité.`,
  ]
  let y = 112
  for (const l of lines) {
    doc.text(s(l), M, y)
    y += 16
  }

  autoTable(doc, {
    startY: y + 8,
    margin: { left: M, right: M },
    head: [['Date', 'Installation', 'Paramètres', 'Conclusion sanitaire']],
    body: sorted.map((p) => [fmtDateTime(p.date), p.installation, String(p.nParams), VERDICT_LABEL[p.verdict]]).map((r) => r.map(s)),
    styles: { fontSize: 9, cellPadding: 4, textColor: INK },
    headStyles: { fillColor: TEAL, textColor: 255 },
    columnStyles: { 2: { halign: 'right', cellWidth: 60 } },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 3) {
        const v = sorted[d.row.index].verdict
        d.cell.styles.textColor = v === 'non-conforme' ? [180, 35, 24] : v === 'reference' ? [160, 100, 10] : [40, 120, 80]
        d.cell.styles.fontStyle = 'bold'
      }
    },
  })

  if (opts.detail) {
    for (const pv of sorted) {
      doc.addPage()
      let yy = 50
      doc.setTextColor(...INK)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text(s(`Prélèvement du ${fmtDateTime(pv.date)}`), M, yy)
      yy += 18
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      const meta = [
        `Installation : ${pv.installation}`,
        pv.distributeur ? `Distributeur : ${pv.distributeur}` : '',
        pv.reseaux.length ? `Réseaux : ${pv.reseaux.map((r) => r.nom).join(', ')}` : '',
        `Référence : ${pv.id}`,
      ].filter(Boolean)
      for (const m of meta) {
        doc.text(doc.splitTextToSize(s(m), W - 2 * M), M, yy)
        yy += 13
      }
      yy += 4
      doc.setFont('helvetica', 'bold')
      doc.text('Conclusion sanitaire', M, yy)
      yy += 13
      doc.setFont('helvetica', 'normal')
      const concl = doc.splitTextToSize(s(pv.conclusion), W - 2 * M)
      doc.text(concl, M, yy)
      yy += concl.length * 12 + 4
      doc.text(
        s(
          `Limites bactériologiques : ${CONF_LABEL(pv.conf.limBact)} | Limites physico-chimiques : ${CONF_LABEL(pv.conf.limPc)}`,
        ),
        M,
        yy,
      )
      yy += 12
      doc.text(
        s(
          `Références bactériologiques : ${CONF_LABEL(pv.conf.refBact)} | Références physico-chimiques : ${CONF_LABEL(pv.conf.refPc)}`,
        ),
        M,
        yy,
      )
      const rows = [...pv.rows].sort(
        (a, b) => a.family.localeCompare(b.family) || a.libelle_parametre.localeCompare(b.libelle_parametre, 'fr'),
      )
      autoTable(doc, {
        startY: yy + 12,
        margin: { left: M, right: M },
        head: [['Famille', 'Paramètre', 'Résultat', 'Unité', 'Limite', 'Référence', 'Statut']],
        body: rows.map((r) =>
          [
            FAMILY_BY_ID[r.family]?.label ?? r.family,
            r.libelle_parametre,
            r.display,
            r.libelle_unite ?? '',
            r.limite_qualite_parametre ?? '',
            r.reference_qualite_parametre ?? '',
            STATUS[r.flag],
          ].map(s),
        ),
        styles: { fontSize: 8, cellPadding: 3, textColor: INK },
        headStyles: { fillColor: TEAL, textColor: 255 },
        columnStyles: { 2: { halign: 'right' } },
        didParseCell: (d) => {
          if (d.section === 'body') {
            const f = rows[d.row.index].flag
            if (f === 'limit') {
              d.cell.styles.textColor = [180, 35, 24]
              d.cell.styles.fontStyle = 'bold'
            } else if (f === 'ref') d.cell.styles.textColor = [160, 100, 10]
          }
        },
      })
    }
  }

  addFooters(doc, M)

  doc.save(opts.filename ?? `eau-${ctx.commune.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${ctx.from}_${ctx.to}.pdf`)
}

export function exportCsv(ctx: PdfContext, pvs: Pv[]) {
  const head = [
    'date_prelevement', 'code_prelevement', 'installation', 'famille', 'code_parametre', 'parametre',
    'resultat', 'unite', 'limite_qualite', 'reference_qualite', 'statut', 'conclusion',
  ]
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
  const lines = [head.join(';')]
  for (const pv of [...pvs].sort((a, b) => a.ts - b.ts))
    for (const r of pv.rows)
      lines.push(
        [
          pv.date, pv.id, pv.installation, FAMILY_BY_ID[r.family]?.label ?? r.family, r.code_parametre, r.libelle_parametre,
          r.display, r.libelle_unite ?? '', r.limite_qualite_parametre ?? '', r.reference_qualite_parametre ?? '',
          STATUS[r.flag], pv.conclusion,
        ]
          .map((x) => esc(String(x)))
          .join(';'),
      )
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `eau-${ctx.commune.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${ctx.from}_${ctx.to}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

/** PDF « Écarts » : uniquement les dépassements, leur récurrence et la carte de chaleur. */
export function exportEcarts(ctx: PdfContext, pvs: Pv[], series: Series[]) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 40
  const hist = new Map(series.map((x) => [x.key, x]))
  const sorted = [...pvs].sort((a, b) => b.ts - a.ts)

  doc.setFillColor(...INK)
  doc.rect(0, 0, W, 86, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Synthèse des écarts - eau potable', M, 40)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(s(`${ctx.commune} - période du ${fmtDate(ctx.from)} au ${fmtDate(ctx.to)}${ctx.q ? ` - recherche : ${ctx.q}` : ''}`), M, 62)
  if (ctx.demo) {
    doc.setTextColor(255, 200, 120)
    doc.text('DONNÉES DE DÉMONSTRATION - SANS VALEUR', W - M, 62, { align: 'right' })
  }

  const issues = sorted.flatMap((p) => p.rows.filter((r) => r.flag === 'limit' || r.flag === 'ref').map((r) => ({ p, r })))
  const nLim = issues.filter((x) => x.r.flag === 'limit').length
  doc.setTextColor(...INK)
  doc.setFontSize(11)
  doc.text(s(`${sorted.length} prélèvement(s) · ${sorted.filter((p) => p.verdict === 'non-conforme').length} non conforme(s) · ${nLim} limite(s) dépassée(s) · ${issues.length - nLim} référence(s) dépassée(s)`), M, 112)

  if (issues.length) {
    autoTable(doc, {
      startY: 126,
      margin: { left: M, right: M },
      head: [['Date', 'Installation', 'Paramètre', 'Résultat', 'Seuil', '% seuil', 'Récurrence', 'Statut']],
      body: issues.map(({ p, r }) => {
        const h = hist.get(r.code_parametre || r.libelle_parametre)
        const ra = ratioOf(r)
        return [
          fmtDate(p.date),
          p.installation,
          r.libelle_parametre,
          `${r.display} ${r.libelle_unite ?? ''}`.trim(),
          (r.flag === 'limit' ? r.limite_qualite_parametre : r.reference_qualite_parametre) ?? '',
          ra ? `${Math.round(ra.pct)} %` : '',
          h ? `${h.nLimit + h.nRef} / ${h.pts.length}` : '',
          STATUS[r.flag],
        ].map(s)
      }),
      styles: { fontSize: 8, cellPadding: 3, textColor: INK },
      headStyles: { fillColor: TEAL, textColor: 255 },
      columnStyles: { 3: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'center' } },
      didParseCell: (d) => {
        if (d.section === 'body') {
          const f = issues[d.row.index].r.flag
          d.cell.styles.textColor = f === 'limit' ? [180, 35, 24] : [160, 100, 10]
          if (f === 'limit') d.cell.styles.fontStyle = 'bold'
        }
      },
    })
  } else {
    doc.text('Aucune limite ni référence de qualité dépassée sur la période.', M, 136)
  }

  // Carte de chaleur : % de la limite, paramètres les plus proches de la limite en premier.
  const rows = series.filter((x) => x.maxPct >= 50).sort((a, b) => b.maxPct - a.maxPct).slice(0, 36)
  const cols = [...pvs].sort((a, b) => a.ts - b.ts)
  if (rows.length && cols.length) {
    const LBL = 170
    const CW = 13
    const RH = 12
    const per = Math.max(1, Math.floor((W - 2 * M - LBL) / CW))
    const color = (pct: number | null): [number, number, number] =>
      pct === null ? [238, 243, 245] : pct > 100 ? [180, 35, 24] : pct >= 80 ? [242, 182, 109] : pct >= 50 ? [241, 230, 166] : [207, 232, 218]
    for (let c0 = 0; c0 < cols.length; c0 += per) {
      doc.addPage()
      const chunk = cols.slice(c0, c0 + per)
      doc.setTextColor(...INK)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.text('Résultats en % de la limite de qualité', M, 50)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(s(`Prélèvements du ${fmtDate(chunk[0].date)} au ${fmtDate(chunk[chunk.length - 1].date)}. Rouge : au-dessus de la limite · orange : 80 à 100 % · jaune : 50 à 80 % · vert : moins de 50 %.`), M, 64)
      const top = 120
      chunk.forEach((p, i) => {
        doc.setTextColor(...INK)
        doc.setFontSize(6.5)
        doc.text(fmtShort(p.ts), M + LBL + i * CW + 9, top - 4, { angle: 90 })
      })
      rows.forEach((x, ri) => {
        const y = top + ri * RH
        doc.setFontSize(7)
        doc.setTextColor(...INK)
        doc.text(s(x.label.length > 36 ? x.label.slice(0, 35) + '…' : x.label), M, y + 8.5)
        const by = new Map(x.pts.map((q) => [q.pvId, q]))
        chunk.forEach((p, i) => {
          const q = by.get(p.id)
          const pct = q ? q.pct : null
          doc.setFillColor(...color(q ? pct : null))
          doc.rect(M + LBL + i * CW, y, CW - 1, RH - 1, 'F')
          if (pct !== null && pct > 100) {
            doc.setTextColor(255, 255, 255)
            doc.setFontSize(7)
            doc.text('x', M + LBL + i * CW + 4, y + 8)
          }
        })
      })
    }
  }

  addFooters(doc, M)
  doc.save(`ecarts-${ctx.commune.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${ctx.from}_${ctx.to}.pdf`)
}
