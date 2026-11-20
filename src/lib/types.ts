/** Une ligne de l'API Hub'Eau « resultats_dis » : un paramètre analysé dans un prélèvement. */
export interface Row {
  code_prelevement: string
  date_prelevement: string
  code_parametre: string
  libelle_parametre: string
  resultat_alphanumerique: string | null
  resultat_numerique: number | null
  libelle_unite: string | null
  limite_qualite_parametre: string | null
  reference_qualite_parametre: string | null
  conclusion_conformite_prelevement: string | null
  conformite_limites_bact_prelevement: string | null
  conformite_limites_pc_prelevement: string | null
  conformite_references_bact_prelevement: string | null
  conformite_references_pc_prelevement: string | null
  nom_distributeur: string | null
  nom_installation_amont: string | null
  code_installation_amont: string | null
  nom_commune: string | null
  code_lieu_analyse: string | null
  reference_analyse: string | null
  reseaux?: { code: string; nom: string; debit?: string }[] | null
}

export type Flag = 'limit' | 'ref' | 'lq' | 'ok'

export interface ParamRow extends Row {
  family: string
  flag: Flag
  value: number | null
  display: string
}

export type Verdict = 'conforme' | 'reference' | 'non-conforme' | 'inconnu'

export interface Pv {
  id: string
  date: string
  ts: number
  installation: string
  installationCode: string
  distributeur: string
  reseaux: { code: string; nom: string }[]
  conclusion: string
  conf: { limBact: string; limPc: string; refBact: string; refPc: string }
  verdict: Verdict
  rows: ParamRow[]
  byFamily: Record<string, number>
  nParams: number
  nLimit: number
  nRef: number
}

export interface Place {
  code: string
  name: string
}
