import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'

function excelDateToISO(raw: unknown): string | null {
  if (typeof raw === 'number') {
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
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Keine Datei' }, { status: 400 })

    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[]

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
