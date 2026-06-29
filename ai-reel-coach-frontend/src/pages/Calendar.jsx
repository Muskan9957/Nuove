import { useState, useEffect } from 'react'
import { api } from '../api'
import { useLang } from '../i18n.jsx'
import { useToast } from '../components/Toast'
import { MicButton } from '../components/VoiceAssistant'

// Status configuration
const STATUS_CONFIG = {
  PLANNED:   { color: '#FFD60A', bg: 'rgba(255,214,10,0.15)',   label_key: 'planned'   },
  DRAFTED:   { color: '#FF9F43', bg: 'rgba(255,159,67,0.15)',   label_key: 'drafted'   },
  PUBLISHED: { color: '#00C9A7', bg: 'rgba(0,201,167,0.15)',    label_key: 'published' },
}

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year, month) {
  // 0=Sunday, convert to Mon-based (Mon=0)
  const d = new Date(year, month, 1).getDay()
  return (d + 6) % 7
}

function buildCalendarGrid(year, month) {
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay    = getFirstDayOfMonth(year, month)
  const grid        = []

  let day = 1 - firstDay
  for (let week = 0; week < 6; week++) {
    const row = []
    for (let d = 0; d < 7; d++) {
      row.push(day >= 1 && day <= daysInMonth ? day : null)
      day++
    }
    grid.push(row)
    if (day > daysInMonth) break
  }
  return grid
}

/* ─── Side Panel ─────────────────────────────────────────────────── */
function EntryPanel({ date, entries, onClose, onSave, onDelete }) {
  const { t }   = useLang()
  const toast   = useToast()
  const [form, setForm] = useState({ title: '', status: 'PLANNED', note: '' })
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  const openNew = () => {
    setForm({ title: '', status: 'PLANNED', note: '' })
    setEditId(null)
  }

  const openEdit = (entry) => {
    setForm({ title: entry.title, status: entry.status, note: entry.note || '' })
    setEditId(entry.id)
  }

  const handleSave = async () => {
    if (!form.title.trim()) { toast('Please enter a title', 'error'); return }
    setSaving(true)
    try {
      await onSave(editId, { ...form, date })
      toast(editId ? 'Entry updated!' : 'Entry added!', 'success')
      openNew()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this entry?')) return
    try {
      await onDelete(id)
      toast('Entry deleted', 'success')
      if (editId === id) openNew()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const dateStr = date
    ? new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : ''

  return (
    <div style={panelStyles.overlay} onClick={onClose}>
      <div style={panelStyles.panel} onClick={e => e.stopPropagation()}>
        <div style={panelStyles.header}>
          <div>
            <div style={panelStyles.dateLabel}>{dateStr}</div>
            <div style={panelStyles.panelTitle}>Content Entries</div>
          </div>
          <button onClick={onClose} style={panelStyles.closeBtn}>✕</button>
        </div>

        {/* Existing entries */}
        {entries.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            {entries.map(entry => {
              const cfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.PLANNED
              return (
                <div key={entry.id} style={{ ...panelStyles.entryRow, borderLeft: `3px solid ${cfg.color}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={panelStyles.entryTitle}>{entry.title}</div>
                    {entry.note && <div style={panelStyles.entryNote}>{entry.note}</div>}
                    <span style={{ ...panelStyles.statusChip, background: cfg.bg, color: cfg.color }}>
                      {t(cfg.label_key)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openEdit(entry)} style={panelStyles.iconBtn} title="Edit">✏</button>
                    <button onClick={() => handleDelete(entry.id)} style={{ ...panelStyles.iconBtn, color: '#FF6B6B' }} title="Delete">🗑</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Add / Edit form */}
        <div style={panelStyles.formWrap}>
          <div style={panelStyles.formTitle}>{editId ? 'Edit Entry' : 'Add Entry'}</div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Title</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <input
                className="input"
                placeholder="Content title..."
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                style={{ flex: 1 }}
              />
              <MicButton onResult={text => setForm(f => ({ ...f, title: text }))} />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setForm(f => ({ ...f, status: key }))}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: form.status === key ? `2px solid ${cfg.color}` : '1px solid var(--border)',
                    background: form.status === key ? cfg.bg : 'var(--surface2)',
                    color: form.status === key ? cfg.color : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: form.status === key ? 600 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  {t(cfg.label_key)}
                </button>
              ))}
            </div>
          </div>

          <div className="field" style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Note (optional)</label>
            <textarea
              className="textarea"
              placeholder="Any notes..."
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              rows={2}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSave}
              className="btn btn-primary btn-sm"
              disabled={saving}
              style={{ flex: 1 }}
            >
              {saving ? t('loading') : (editId ? t('save') : '+ Add')}
            </button>
            {editId && (
              <button
                onClick={openNew}
                className="btn btn-ghost btn-sm"
              >
                {t('cancel')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Calendar Page ──────────────────────────────────────────────── */
export default function Calendar() {
  const { t }    = useLang()
  const toast    = useToast()
  const now      = new Date()

  const [year,   setYear]   = useState(now.getFullYear())
  const [month,  setMonth]  = useState(now.getMonth())
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null) // { date, entries }

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`

  useEffect(() => {
    setLoading(true)
    api.getCalendar(monthKey)
      .then(data => setEntries(data.entries || []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [monthKey])

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const getEntriesForDay = (day) => {
    if (!day) return []
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return entries.filter(e => e.date?.startsWith(dateStr))
  }

  const openDay = (day) => {
    if (!day) return
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setSelected({ date: dateStr, entries: getEntriesForDay(day) })
  }

  const handleSave = async (editId, data) => {
    if (editId) {
      const updated = await api.updateCalendarEntry(editId, data)
      setEntries(prev => prev.map(e => e.id === editId ? { ...e, ...data } : e))
      // refresh selected panel entries
      setSelected(s => s ? { ...s, entries: s.entries.map(e => e.id === editId ? { ...e, ...data } : e) } : s)
    } else {
      const created = await api.createCalendarEntry(data)
      const newEntry = created.entry || { ...data, id: Date.now() }
      setEntries(prev => [...prev, newEntry])
      setSelected(s => s ? { ...s, entries: [...s.entries, newEntry] } : s)
    }
  }

  const handleDelete = async (id) => {
    await api.deleteCalendarEntry(id)
    setEntries(prev => prev.filter(e => e.id !== id))
    setSelected(s => s ? { ...s, entries: s.entries.filter(e => e.id !== id) } : s)
  }

  const grid = buildCalendarGrid(year, month)
  const today = now
  const isToday = (day) =>
    day &&
    today.getFullYear() === year &&
    today.getMonth() === month &&
    today.getDate() === day

  return (
    <div className="page-enter">
      <h1 className="page-title">{t('calendar_title')}</h1>
      <p className="page-sub">Plan, draft, and track your content publishing schedule.</p>

      {/* Month Navigation */}
      <div style={calStyles.monthNav}>
        <button onClick={prevMonth} style={calStyles.navBtn}>&#8249;</button>
        <div style={calStyles.monthTitle}>
          {MONTHS[month]} {year}
        </div>
        <button onClick={nextMonth} style={calStyles.navBtn}>&#8250;</button>
      </div>

      {/* Day of week headers */}
      <div style={calStyles.grid}>
        {DAYS_OF_WEEK.map(d => (
          <div key={d} style={calStyles.dayHeader}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div style={{ ...calStyles.grid, gap: 4 }}>
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} style={calStyles.skeleton} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {grid.map((row, wi) => (
            <div key={wi} style={calStyles.grid}>
              {row.map((day, di) => {
                const dayEntries = getEntriesForDay(day)
                const today_flag = isToday(day)
                return (
                  <div
                    key={di}
                    onClick={() => openDay(day)}
                    style={{
                      ...calStyles.dayCell,
                      ...(day ? calStyles.dayCellActive : calStyles.dayCellEmpty),
                      ...(today_flag ? calStyles.dayCellToday : {}),
                    }}
                  >
                    {day && (
                      <>
                        <div style={{
                          ...calStyles.dayNumber,
                          color: today_flag ? 'var(--accent)' : 'var(--text)',
                          fontWeight: today_flag ? 700 : 500,
                        }}>
                          {day}
                        </div>
                        <div style={calStyles.chipsWrap}>
                          {dayEntries.slice(0, 3).map((entry, i) => {
                            const cfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.PLANNED
                            return (
                              <div
                                key={i}
                                style={{
                                  ...calStyles.chip,
                                  background: cfg.bg,
                                  color: cfg.color,
                                  borderLeft: `2px solid ${cfg.color}`,
                                }}
                                title={entry.title}
                              >
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {entry.title}
                                </span>
                              </div>
                            )
                          })}
                          {dayEntries.length > 3 && (
                            <div style={calStyles.moreChip}>+{dayEntries.length - 3}</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div style={calStyles.legend}>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} style={calStyles.legendItem}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t(cfg.label_key)}</span>
          </div>
        ))}
      </div>

      {/* Side Panel */}
      {selected && (
        <EntryPanel
          date={selected.date}
          entries={selected.entries}
          onClose={() => setSelected(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}

const calStyles = {
  monthNav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 20,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: '1px solid var(--border)',
    background: 'var(--surface2)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: '1.4rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },
  monthTitle: {
    fontFamily: 'var(--font-head)',
    fontWeight: 700,
    fontSize: '1.2rem',
    minWidth: 180,
    textAlign: 'center',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 4,
    marginBottom: 4,
  },
  dayHeader: {
    textAlign: 'center',
    fontSize: '0.72rem',
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--text-faint)',
    padding: '6px 0',
  },
  dayCell: {
    minHeight: 80,
    borderRadius: 10,
    padding: '6px 6px 4px',
    cursor: 'pointer',
    transition: 'border-color 0.15s',
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    overflow: 'hidden',
  },
  dayCellActive: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  dayCellEmpty: {
    background: 'transparent',
    border: '1px solid transparent',
    cursor: 'default',
  },
  dayCellToday: {
    border: '1px solid rgba(255,95,31,0.4)',
    background: 'rgba(255,95,31,0.05)',
  },
  dayNumber: {
    fontSize: '0.82rem',
    lineHeight: 1,
    marginBottom: 2,
  },
  chipsWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
    overflow: 'hidden',
  },
  chip: {
    fontSize: '0.65rem',
    padding: '2px 5px',
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
    maxWidth: '100%',
  },
  moreChip: {
    fontSize: '0.65rem',
    color: 'var(--text-faint)',
    padding: '1px 4px',
  },
  skeleton: {
    minHeight: 80,
    borderRadius: 10,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    animation: 'pulse 1.5s ease infinite',
  },
  legend: {
    display: 'flex',
    gap: 16,
    marginTop: 16,
    flexWrap: 'wrap',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
}

const panelStyles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(4px)',
    zIndex: 200,
    display: 'flex',
    justifyContent: 'flex-end',
  },
  panel: {
    width: '100%',
    maxWidth: 400,
    background: 'var(--surface)',
    borderLeft: '1px solid var(--border)',
    height: '100%',
    overflowY: 'auto',
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottom: '1px solid var(--border)',
  },
  dateLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-faint)',
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 2,
  },
  panelTitle: {
    fontFamily: 'var(--font-head)',
    fontWeight: 700,
    fontSize: '1rem',
  },
  closeBtn: {
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text-muted)',
    cursor: 'pointer',
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  entryRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
    padding: '10px 12px',
    background: 'var(--surface2)',
    borderRadius: 10,
    marginBottom: 8,
  },
  entryTitle: {
    fontSize: '0.875rem',
    fontWeight: 500,
    marginBottom: 4,
  },
  entryNote: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    marginBottom: 6,
    lineHeight: 1.4,
  },
  statusChip: {
    display: 'inline-flex',
    padding: '2px 8px',
    borderRadius: 99,
    fontSize: '0.7rem',
    fontWeight: 600,
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase',
  },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px 6px',
    borderRadius: 6,
    fontSize: '0.875rem',
    lineHeight: 1,
  },
  formWrap: {
    padding: '16px',
    background: 'var(--surface2)',
    borderRadius: 12,
    border: '1px solid var(--border)',
    marginTop: 4,
  },
  formTitle: {
    fontFamily: 'var(--font-head)',
    fontWeight: 600,
    fontSize: '0.875rem',
    marginBottom: 14,
    color: 'var(--text-muted)',
  },
}
