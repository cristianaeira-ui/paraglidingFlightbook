import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function excelDateToISO(raw: unknown): string | null {
  if (typeof raw === 'number') {
    // Excel serial date
    const epoch = new Date(1899, 11, 30)
    epoch.setDate(epoch.getDate() + Math.floor(raw))
    const y = epoch.getFullYear()
    const m = String(epoch.getMonth() + 1).padStart(2, '0')
    const d = String(epoch.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof raw === 'string' && raw.trim()) {
    const s = raw.trim()
    const dmy = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  }
  return null
}

export async function POST(req: Request) {
  try {
    const { rows } = await req.json() as { rows: Record<string, unknown>[] }
    if (!Array.isArray(rows)) return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })

    let imported = 0, skipped = 0
    const BATCH = 100

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      const records: Record<string, unknown>[] = []
      const starts = new Set<string>(), lands = new Set<string>(), schirme = new Set<string>()

      for (const row of batch) {
        const datum = excelDateToISO(row['Datum'] ?? row['datum'] ?? '')
        const startplatz = String(row['Start'] ?? row['Startplatz'] ?? '').trim()
        const landeplatz = String(row['Landung'] ?? row['Landeplatz'] ?? '').trim()
        const gleitschirm = String(row['Gleitschirm'] ?? '').trim()
        const raw = row['Flugzeit in min'] ?? row['Flugzeit'] ?? ''
        const flugzeit = raw !== '' ? (parseInt(String(raw)) || null) : null
        const bemerkungen = String(row['Kommentar'] ?? row['Bemerkungen'] ?? '').trim() || null

        if (!datum || !startplatz || !landeplatz || !gleitschirm) { skipped++; continue }

        records.push({ datum, startplatz, landeplatz, gleitschirm, gurtzeug: null, flugzeit, bemerkungen })
        starts.add(startplatz); lands.add(landeplatz); schirme.add(gleitschirm)
      }

      if (starts.size) await supabase.from('startplaetze').upsert([...starts].map(name => ({ name })), { onConflict: 'name' })
      if (lands.size) await supabase.from('landplaetze').upsert([...lands].map(name => ({ name })), { onConflict: 'name' })
      if (schirme.size) await supabase.from('gleitschirme').upsert([...schirme].map(name => ({ name })), { onConflict: 'name' })

      if (records.length) {
        const { error } = await supabase.from('flights').insert(records)
        if (!error) imported += records.length
      }
    }

    return NextResponse.json({ imported, skipped })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
