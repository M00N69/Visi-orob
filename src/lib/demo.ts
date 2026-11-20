import type { Row } from './types'

/** Données fictives pour tester l'interface hors ligne. Jamais utilisées sans le bandeau « démonstration ». */
export function demoRows(from: string, to: string): Row[] {
  const rows: Row[] = []
  const start = new Date(from + 'T08:00:00Z')
  const end = new Date(to + 'T08:00:00Z')
  const sites = [
    { code: '069000069', nom: 'CENTRE (DÉMO)' },
    { code: '069003595', nom: 'EST (DÉMO)' },
  ]
  const reseaux = sites.map((s) => ({ code: s.code, nom: s.nom }))
  const molecules = [
    'Atrazine déséthyl', 'Atrazine', 'Simazine', 'Terbuthylazine', 'Métolachlore', 'Métolachlore ESA', 'Métolachlore OXA',
    'Chlortoluron', 'Diuron', 'Isoproturon', 'Glyphosate', 'AMPA', 'Bentazone', 'Boscalid', 'Chloridazone desphényl',
    'Métazachlore ESA', 'Métazachlore OXA', 'Alachlore ESA', 'Acétochlore ESA', 'Chlorothalonil R471811',
  ]
  const pfas = ['PFOA', 'PFOS', 'PFHxS', 'PFNA', 'PFBA', 'PFPeA', 'PFHxA', 'PFHpA']
  let i = 0
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 9), i++) {
    const site = sites[i % 2]
    const id = `DEMO${String(100000 + i)}`
    const level = i % 6 // 0 : complet, 3 : intermédiaire, autres : routine
    const bad = i === 4
    const refOnly = i === 7
    const mk = (code: string, label: string, alpha: string | null, num: number | null, unit: string, lim: string | null, ref: string | null): Row => ({
      code_prelevement: id,
      date_prelevement: d.toISOString().replace('.000', ''),
      code_parametre: code,
      libelle_parametre: label,
      resultat_alphanumerique: alpha,
      resultat_numerique: num,
      libelle_unite: unit,
      limite_qualite_parametre: lim,
      reference_qualite_parametre: ref,
      conclusion_conformite_prelevement: bad
        ? "Eau d'alimentation non conforme aux exigences de qualité en vigueur pour le paramètre nitrates."
        : refOnly
          ? "Eau d'alimentation conforme aux exigences de qualité mais non conforme aux références de qualité (chlorures)."
          : "Eau d'alimentation conforme aux exigences de qualité en vigueur pour l'ensemble des paramètres mesurés.",
      conformite_limites_bact_prelevement: 'C',
      conformite_limites_pc_prelevement: bad ? 'N' : 'C',
      conformite_references_bact_prelevement: 'C',
      conformite_references_pc_prelevement: refOnly ? 'N' : 'C',
      nom_distributeur: 'DISTRIBUTEUR DÉMO',
      nom_installation_amont: site.nom,
      code_installation_amont: site.code,
      nom_commune: 'COMMUNE DÉMO',
      code_lieu_analyse: 'L',
      reference_analyse: 'R' + id,
      reseaux,
    })
    // Routine : microbiologie + physico-chimie de base
    rows.push(mk('1449', 'Escherichia coli /100ml-MS', '0', 0, 'n/(100mL)', '<=0', null))
    rows.push(mk('1448', 'Entérocoques /100ml-MS', '0', 0, 'n/(100mL)', '<=0', null))
    rows.push(mk('1447', 'Bactéries coliformes /100ml-MS', '0', 0, 'n/(100mL)', null, '<=0'))
    rows.push(mk('5440', 'Bact. aér. revivifiables à 22°-68h', '<1', 0, 'n/mL', null, null))
    rows.push(mk('1302', 'pH', null, 7.4 + (i % 3) * 0.1, 'unitépH', '>=6.5 et <=9', null))
    rows.push(mk('1303', 'Conductivité à 25°C', null, 520 + i * 3, 'µS/cm', null, '>=200 et <=1100'))
    rows.push(mk('1295', 'Turbidité néphélométrique NFU', null, 0.2 + (i % 4) * 0.05, 'NFU', null, '<=2'))
    rows.push(mk('1399', 'Chlore libre', null, 0.18 + (i % 3) * 0.04, 'mg(Cl2)/L', null, null))
    rows.push(mk('1340', 'Nitrates (en NO3)', null, bad ? 52 : 18 + (i % 5), 'mg/L', '<=50', null))
    if (level !== 1 && level !== 5) {
      rows.push(mk('1339', 'Nitrites (en NO2)', '<0,02', 0, 'mg/L', '<=0.5', null))
      rows.push(mk('1335', 'Ammonium (en NH4)', '<0,05', 0, 'mg/L', null, '<=0.1'))
      rows.push(mk('1337', 'Chlorures', null, refOnly ? 270 : 38, 'mg/L', null, '<=250'))
    }
    if (level === 0 || level === 3) {
      const n = level === 0 ? molecules.length : 4
      for (const m of molecules.slice(0, n))
        rows.push(mk('P' + m.slice(0, 4), m, '<0,02', 0, 'µg/L', '<=0.1', null))
      rows.push(mk('6276', 'Pesticides totaux', '<0,02', 0, 'µg/L', '<=0.5', null))
    }
    if (level === 0) {
      for (const p of pfas) rows.push(mk('F' + p, p, '<2', 0, 'ng/L', null, null))
      rows.push(mk('1369', 'Arsenic', null, 1.4, 'µg/L', '<=10', null))
      rows.push(mk('1382', 'Plomb', '<0,5', 0, 'µg/L', '<=10', null))
      rows.push(mk('1370', 'Aluminium total µg/l', null, 28, 'µg/L', null, '<=200'))
    }
  }
  return rows
}
