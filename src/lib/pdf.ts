import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { CONF_LABEL, VERDICT_LABEL } from './analysis'
import { FAMILY_BY_ID } from './families'
import { fmtDate, fmtDateTime } from './format'
import type { Pv } from './types'

export interface PdfContext {
  commune: string
  from: string
  to: string
  demo: boolean
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

export function exportPdf(ctx: PdfContext, pvs: Pv[], opts: { detail: boolean; filename?: string }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 40
  const sorted = [...pvs].sort((a, b) => a.ts - b.ts)
  const now = new Date().toISOString()

  // Bandeau de titre
  doc.setFillColor(...INK)
  doc.rect(0, 0, W, 86, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(s(sorted.length === 1 ? `Procès-verbal d'analyse du ${fmtDate(sorted[0].date)}` : "Contrôle sanitaire de l'eau potable"), M, 40)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(s(`${ctx.commune} - période du ${fmtDate(ctx.from)} au ${fmtDate(ctx.to)}`), M, 62)
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

  // Pied de page sur toutes les pages
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
