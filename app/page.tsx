'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Flight {
  id: number
  datum: string
  startplatz: string
  landeplatz: string
  gleitschirm: string
  gurtzeug: string | null
  flugzeit: number | null
  bemerkungen: string | null
  created_at: string
}

interface Options {
  startplaetze: string[]
  landplaetze: string[]
  gleitschirme: string[]
  gurtzeugs: string[]
}

interface FormState {
  datum: string
  startplatz: string
  landeplatz: string
  gleitschirm: string
  gurtzeug: string
  flugzeitH: string
  flugzeitM: string
  bemerkungen: string
}

type Tab = 'erfassen' | 'fluege' | 'dashboard'

const QUOTES = [
  "Der Himmel ist nicht die Grenze – er ist dein Zuhause! ✨",
  "Jeder Flug macht dich freier, Cristiana! 🪂",
  "Mit jedem Flug wächst deine Seele! 💙",
  "Der Wind ruft dich schon! 🌬️",
  "Träum hoch – flieg noch höher! 🦅",
  "Dein nächstes Abenteuer wartet in den Bergen! 🏔️",
  "Du hast Flügel, Cristiana – nutz sie! 🌤️",
  "Der Himmel gehört dir! 🌈",
]

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const DEFAULT_FORM: FormState = {
  datum: todayStr(),
  startplatz: '', landeplatz: '', gleitschirm: '', gurtzeug: '',
  flugzeitH: '', flugzeitM: '', bemerkungen: '',
}

function formatDate(s: string) {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return date.toLocaleDateString('de-CH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtMin(min: number | null) {
  if (!min) return '—'
  const h = Math.floor(min / 60), m = min % 60
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}

function ComboBox({ value, onChange, options, placeholder, id }: {
  value: string; onChange: (v: string) => void
  options: string[]; placeholder: string; id?: string
}) {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const filtered = value.trim()
    ? options.filter(o => o.toLowerCase().includes(value.toLowerCase().trim()))
    : options
  const hasExact = options.some(o => o.toLowerCase() === value.trim().toLowerCase())
  const showAdd = value.trim().length > 0 && !hasExact
  const select = (val: string) => { onChange(val); setOpen(false); inputRef.current?.blur() }

  return (
    <div className="combo-wrap">
      <input
        id={id} ref={inputRef}
        className={`field-input${open && (filtered.length > 0 || showAdd) ? ' combo-input-open' : ''}`}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        autoComplete="off" autoCorrect="off" autoCapitalize="words" spellCheck={false}
      />
      {open && (filtered.length > 0 || showAdd) && (
        <div className="combo-dropdown">
          {filtered.slice(0, 40).map(item => (
            <div key={item} className="combo-item" onPointerDown={e => { e.preventDefault(); select(item) }}>{item}</div>
          ))}
          {showAdd && (
            <div className="combo-item combo-add" onPointerDown={e => { e.preventDefault(); select(value.trim()) }}>
              + &ldquo;{value.trim()}&rdquo; hinzufügen
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Toast({ message }: { message: string }) {
  return <div className={`toast-wrap${message ? ' show' : ''}`}><div className="toast">{message}</div></div>
}

function BarList({ items }: { items: { label: string; count: number; time?: number }[] }) {
  const max = items[0]?.count || 1
  return (
    <div>
      {items.map(({ label, count, time }) => (
        <div key={label} className="dash-row">
          <div className="dash-row-label" title={label}>{label}</div>
          <div className="bar-bg"><div className="bar-fill" style={{ width: `${Math.round(count / max * 100)}%` }} /></div>
          <div className="dash-row-count">{count}</div>
          {time !== undefined && <div style={{ fontSize: 11, color: 'var(--text-muted)', width: 50, textAlign: 'right', flexShrink: 0 }}>{fmtMin(time)}</div>}
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>('erfassen')
  const [flights, setFlights] = useState<Flight[]>([])
  const [options, setOptions] = useState<Options>({ startplaetze: [], landplaetze: [], gleitschirme: [], gurtzeugs: [] })
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState>({ ...DEFAULT_FORM })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [selected, setSelected] = useState<Flight | null>(null)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')
  const [quote] = useState(() => QUOTES[new Date().getMinutes() % QUOTES.length])
  const [dashYear, setDashYear] = useState<string>('all')
  const [saving, setSaving] = useState(false)

  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2800) }, [])

  useEffect(() => {
    Promise.all([
      fetch('/api/flights').then(r => r.json()),
      fetch('/api/options').then(r => r.json()),
    ]).then(([f, o]) => { setFlights(f); setOptions(o); setLoading(false) })
      .catch(() => { setLoading(false); showToast('Verbindungsfehler – Seite neu laden') })
  }, [showToast])

  const setField = (k: keyof FormState, v: string) => setForm(p => ({ ...p, [k]: v }))
  const totalMin = flights.reduce((s, f) => s + (f.flugzeit || 0), 0)
  const totalH = Math.floor(totalMin / 60), totalM = totalMin % 60

  async function saveFlight() {
    if (!form.datum || !form.startplatz.trim() || !form.landeplatz.trim() || !form.gleitschirm.trim()) {
      showToast('Bitte Start, Landung und Gleitschirm angeben ✏️'); return
    }
    setSaving(true)
    const flugzeit = (Number(form.flugzeitH) || 0) * 60 + (Number(form.flugzeitM) || 0) || null
    const body = {
      datum: form.datum, startplatz: form.startplatz.trim(), landeplatz: form.landeplatz.trim(),
      gleitschirm: form.gleitschirm.trim(), gurtzeug: form.gurtzeug.trim() || null,
      flugzeit, bemerkungen: form.bemerkungen.trim() || null,
    }
    try {
      const url = editingId ? `/api/flights/${editingId}` : '/api/flights'
      const res = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error()
      const saved: Flight = await res.json()
      setOptions(prev => {
        const add = (arr: string[], v: string) => v && !arr.includes(v) ? [...arr, v].sort() : arr
        return { startplaetze: add(prev.startplaetze, body.startplatz), landplaetze: add(prev.landplaetze, body.landeplatz), gleitschirme: add(prev.gleitschirme, body.gleitschirm), gurtzeugs: body.gurtzeug ? add(prev.gurtzeugs, body.gurtzeug) : prev.gurtzeugs }
      })
      setFlights(prev => editingId ? prev.map(f => f.id === editingId ? saved : f) : [saved, ...prev])
      const isEdit = !!editingId; resetForm()
      showToast(isEdit ? 'Flug aktualisiert ✓' : 'Flug gespeichert – weiter so, Cristiana! 🪂')
    } catch { showToast('Fehler beim Speichern') }
    finally { setSaving(false) }
  }

  function resetForm() { setForm({ ...DEFAULT_FORM, datum: todayStr() }); setEditingId(null) }

  function startEdit(f: Flight) {
    setSelected(null); setEditingId(f.id)
    setForm({ datum: f.datum, startplatz: f.startplatz, landeplatz: f.landeplatz, gleitschirm: f.gleitschirm, gurtzeug: f.gurtzeug || '', flugzeitH: f.flugzeit ? String(Math.floor(f.flugzeit / 60)) : '', flugzeitM: f.flugzeit ? String(f.flugzeit % 60) : '', bemerkungen: f.bemerkungen || '' })
    setTab('erfassen'); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deleteFlight(id: number) {
    if (!confirm('Diesen Flug wirklich löschen?')) return
    try { await fetch(`/api/flights/${id}`, { method: 'DELETE' }); setFlights(prev => prev.filter(f => f.id !== id)); setSelected(null); showToast('Flug gelöscht') }
    catch { showToast('Fehler beim Löschen') }
  }

  const filteredFlights = search.trim()
    ? flights.filter(f => [f.startplatz, f.landeplatz, f.gleitschirm, f.gurtzeug, f.bemerkungen].some(v => v?.toLowerCase().includes(search.toLowerCase())))
    : flights

  const dashFlights = dashYear === 'all' ? flights : flights.filter(f => f.datum?.startsWith(dashYear))
  const years = Array.from(new Set(flights.map(f => f.datum?.slice(0, 4)).filter((y): y is string => !!y))).sort().reverse()

  function countBy<K extends keyof Flight>(arr: Flight[], key: K) {
    const map: Record<string, { count: number; time: number }> = {}
    arr.forEach(f => { const k = String(f[key] || '—'); if (!map[k]) map[k] = { count: 0, time: 0 }; map[k].count++; map[k].time += f.flugzeit || 0 })
    return Object.entries(map).map(([label, { count, time }]) => ({ label, count, time })).sort((a, b) => b.count - a.count)
  }

  const byYear = years.map(y => { const yf = flights.filter(f => f.datum?.startsWith(y)); return { year: y, count: yf.length, time: yf.reduce((s, f) => s + (f.flugzeit || 0), 0) } })
  const bySchirm = countBy(dashFlights, 'gleitschirm')
  const byGurtzeug = countBy(dashFlights.filter(f => f.gurtzeug), 'gurtzeug')
  const byStart = countBy(dashFlights, 'startplatz').slice(0, 10)
  const byLand = countBy(dashFlights, 'landeplatz').slice(0, 10)
  const dashMin = dashFlights.reduce((s, f) => s + (f.flugzeit || 0), 0)
  const dashH = Math.floor(dashMin / 60), dashM = dashMin % 60
  const avgMin = dashFlights.length ? Math.round(dashMin / dashFlights.length) : 0

  return (
    <>
      <header className="app-header">
        <div className="header-greeting">Willkommen zurück</div>
        <div className="header-title">🪂 Mein Flugbuch</div>
        <div className="header-quote">{quote}</div>
        <div className="header-stats">
          <div className="header-stat"><strong>{flights.length}</strong>&nbsp;Flüge</div>
          <div className="header-stat"><strong>{totalH}h&nbsp;{totalM}min</strong>&nbsp;total</div>
        </div>
        <div style={{ height: 16 }} />
      </header>

      <main className="main-content">
        {/* ERFASSEN */}
        {tab === 'erfassen' && (
          <div>
            {editingId && (
              <div className="edit-indicator">
                <span>✏️ Flug wird bearbeitet</span>
                <button className="btn btn-sm btn-secondary" onClick={resetForm}>Abbrechen</button>
              </div>
            )}
            <div className="card">
              <div className="card-header">
                <div className="card-title">{editingId ? '✏️ Flug bearbeiten' : '➕ Neuer Flug'}</div>
              </div>
              <div className="card-body">
                <div className="field">
                  <label className="field-required" htmlFor="fDatum">Datum</label>
                  <input type="date" id="fDatum" value={form.datum} onChange={e => setField('datum', e.target.value)} />
                </div>
                <div className="field">
                  <label className="field-required">Startplatz</label>
                  <ComboBox value={form.startplatz} onChange={v => setField('startplatz', v)} options={options.startplaetze} placeholder="Suchen oder neu eingeben…" />
                </div>
                <div className="field">
                  <label className="field-required">Landeplatz</label>
                  <ComboBox value={form.landeplatz} onChange={v => setField('landeplatz', v)} options={options.landplaetze} placeholder="Suchen oder neu eingeben…" />
                </div>
                <div className="field">
                  <label className="field-required">Gleitschirm</label>
                  <ComboBox value={form.gleitschirm} onChange={v => setField('gleitschirm', v)} options={options.gleitschirme} placeholder="Suchen oder neu eingeben…" />
                </div>
                <div className="field">
                  <label>Gurtzeug</label>
                  <ComboBox value={form.gurtzeug} onChange={v => setField('gurtzeug', v)} options={options.gurtzeugs} placeholder="Suchen oder neu eingeben…" />
                </div>
                <div className="field">
                  <label>Flugzeit</label>
                  <div className="time-row">
                    <input type="number" placeholder="0" min="0" max="24" inputMode="numeric" value={form.flugzeitH} onChange={e => setField('flugzeitH', e.target.value)} />
                    <span className="time-unit">h</span>
                    <input type="number" placeholder="0" min="0" max="59" inputMode="numeric" value={form.flugzeitM} onChange={e => setField('flugzeitM', e.target.value)} />
                    <span className="time-unit">min</span>
                  </div>
                  {(form.flugzeitH || form.flugzeitM) && (
                    <div className="time-display">⏱ {fmtMin((Number(form.flugzeitH) || 0) * 60 + (Number(form.flugzeitM) || 0))}</div>
                  )}
                </div>
                <div className="field">
                  <label>Bemerkungen</label>
                  <textarea placeholder="Bedingungen, besondere Momente…" value={form.bemerkungen} onChange={e => setField('bemerkungen', e.target.value)} />
                </div>
                <button className="btn btn-primary btn-block" onClick={saveFlight} disabled={saving}>
                  {saving ? '⏳ Speichern…' : editingId ? '✓ Änderungen speichern' : '🪂 Flug speichern'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FLÜGE */}
        {tab === 'fluege' && (
          <div>
            <div className="card">
              <div className="card-header">
                <div className="card-title">📋 Alle Flüge</div>
                <span className="badge">{filteredFlights.length}</span>
              </div>
              <div className="search-wrap">
                <input type="text" className="field-input search-input" placeholder="🔍 Ort, Gleitschirm…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {loading ? (
                <div className="loading"><div className="loading-ring" />Lade Flüge…</div>
              ) : filteredFlights.length === 0 ? (
                <div className="empty">
                  <span className="empty-icon">{search ? '🔍' : '🪂'}</span>
                  <div className="empty-title">{search ? 'Nichts gefunden' : 'Noch keine Flüge'}</div>
                  <div className="empty-sub">{search ? 'Anderen Suchbegriff probieren.' : 'Erfasse deinen ersten Flug!'}</div>
                </div>
              ) : filteredFlights.map(f => (
                <div key={f.id} className="flight-item" onClick={() => setSelected(f)}>
                  <div className="flight-date">{formatDate(f.datum)}</div>
                  <div className="flight-route">{f.startplatz}<span className="flight-arrow">→</span>{f.landeplatz}</div>
                  <div className="flight-chips">
                    <span className="chip">🪂 {f.gleitschirm}</span>
                    {f.flugzeit ? <span className="chip">⏱ {fmtMin(f.flugzeit)}</span> : null}
                    {f.gurtzeug ? <span className="chip">🎝️ {f.gurtzeug}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DASHBOARD */}
        {tab === 'dashboard' && (
          <div>
            <div className="card">
              <div className="filter-wrap">
                <span className={`filter-chip${dashYear === 'all' ? ' active' : ''}`} onClick={() => setDashYear('all')}>Alle Jahre</span>
                {years.map(y => <span key={y} className={`filter-chip${dashYear === y ? ' active' : ''}`} onClick={() => setDashYear(y)}>{y}</span>)}
              </div>
              <div className="stat-grid">
                <div className="stat-tile blue">
                  <div className="stat-tile-value">{dashFlights.length}</div>
                  <div className="stat-tile-label">Flüge {dashYear !== 'all' ? dashYear : 'total'}</div>
                </div>
                <div className="stat-tile blue">
                  <div className="stat-tile-value">{dashH}h&nbsp;{dashM}m</div>
                  <div className="stat-tile-label">Gesamtflugzeit</div>
                </div>
                <div className="stat-tile light">
                  <div className="stat-tile-value">{fmtMin(avgMin)}</div>
                  <div className="stat-tile-label">Ø Flugzeit</div>
                </div>
                <div className="stat-tile light">
                  <div className="stat-tile-value">{new Set(dashFlights.map(f => f.startplatz)).size}</div>
                  <div className="stat-tile-label">Startplätze</div>
                </div>
              </div>
            </div>

            {dashYear === 'all' && (
              <div className="card">
                <div className="card-header"><div className="card-title">📅 Pro Jahr</div></div>
                <div className="dash-section">
                  <table className="year-table">
                    <thead><tr><th>Jahr</th><th>Flüge</th><th>Flugzeit</th><th>Ø Zeit</th></tr></thead>
                    <tbody>
                      {byYear.map(({ year, count, time }) => (
                        <tr key={year}>
                          <td style={{ color: 'var(--primary)', fontWeight: 800, cursor: 'pointer' }} onClick={() => setDashYear(year)}>{year}</td>
                          <td>{count}</td><td>{fmtMin(time)}</td><td>{fmtMin(count ? Math.round(time / count) : 0)}</td>
                        </tr>
                      ))}
                      <tr className="total-row"><td>Total</td><td>{flights.length}</td><td>{fmtMin(totalMin)}</td><td>{fmtMin(flights.length ? Math.round(totalMin / flights.length) : 0)}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-header"><div className="card-title">🪂 Pro Gleitschirm</div></div>
              <div className="dash-section">{bySchirm.length === 0 ? <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Keine Daten</div> : <BarList items={bySchirm} />}</div>
            </div>

            {byGurtzeug.length > 0 && (
              <div className="card">
                <div className="card-header"><div className="card-title">🎝️ Pro Gurtzeug</div></div>
                <div className="dash-section"><BarList items={byGurtzeug} /></div>
              </div>
            )}

            <div className="card">
              <div className="card-header"><div className="card-title">📍 Top Startplätze</div></div>
              <div className="dash-section">{byStart.length === 0 ? <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Keine Daten</div> : <BarList items={byStart} />}</div>
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title">🏁 Top Landplätze</div></div>
              <div className="dash-section">{byLand.length === 0 ? <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Keine Daten</div> : <BarList items={byLand} />}</div>
            </div>
          </div>
        )}

        {loading && tab !== 'erfassen' && <div className="loading"><div className="loading-ring" />Lade Daten…</div>}
      </main>

      <nav className="tab-bar">
        <button className={`tab-btn${tab === 'erfassen' ? ' active' : ''}`} onClick={() => setTab('erfassen')}>
          <span className="tab-icon">✏️</span>Erfassen
        </button>
        <button className={`tab-btn${tab === 'fluege' ? ' active' : ''}`} onClick={() => { setTab('fluege'); setSearch('') }}>
          <span className="tab-icon">📋</span>Flüge
        </button>
        <button className={`tab-btn${tab === 'dashboard' ? ' active' : ''}`} onClick={() => setTab('dashboard')}>
          <span className="tab-icon">📊</span>Dashboard
        </button>
      </nav>

      {selected && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}>
          <div className="modal">
            <div className="modal-handle" />
            <div className="modal-header">
              <div className="modal-title">{selected.startplatz} → {selected.landeplatz}</div>
              <div className="modal-date">📅 {formatDate(selected.datum)}</div>
            </div>
            <div className="detail-row"><div className="detail-label">Startplatz</div><div className="detail-value">{selected.startplatz}</div></div>
            <div className="detail-row"><div className="detail-label">Landeplatz</div><div className="detail-value">{selected.landeplatz}</div></div>
            <div className="detail-row"><div className="detail-label">Gleitschirm</div><div className="detail-value">{selected.gleitschirm}</div></div>
            <div className="detail-row"><div className="detail-label">Gurtzeug</div><div className="detail-value">{selected.gurtzeug || '—'}</div></div>
            <div className="detail-row"><div className="detail-label">Flugzeit</div><div className="detail-value">{fmtMin(selected.flugzeit)}</div></div>
            <div className="detail-row"><div className="detail-label">Bemerkungen</div><div className="detail-value" style={{ whiteSpace: 'pre-wrap' }}>{selected.bemerkungen || '—'}</div></div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => startEdit(selected)}>✏️ Bearbeiten</button>
              <button className="btn btn-danger" onClick={() => deleteFlight(selected.id)}>🗑️ Löschen</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>✕</button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast} />
    </>
  )
}
