const TZ = 'Europe/Paris'

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ })

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  })

export const fmtShort = (ts: number) =>
  new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: TZ })

export const iso10 = (d: Date) => d.toISOString().slice(0, 10)

export const fmtNum = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 3 })

export function monthsAgo(n: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return iso10(d)
}
