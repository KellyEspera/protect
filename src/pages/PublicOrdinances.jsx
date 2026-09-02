// ============================================================================
//  PublicOrdinances.jsx  —  public-facing Barangay Ordinance Archive
// ----------------------------------------------------------------------------
//  No login required — ordinances are public record. Lets residents search
//  and filter enacted ordinances by category, matching the searchable-table
//  pattern used by real LGU ordinance archives (e.g. sbo.itogon.gov.ph).
// ============================================================================

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Search, FileText, ScrollText, Info, X, Download } from 'lucide-react'
import { supabase } from '../lib/supabase'

const CATEGORIES = [
  'Peace and Order',
  'Agriculture and Fisheries',
  'Sanitation and Waste Management',
  'Environmental Protection',
  'Public Health and Safety',
  'Revenue and Taxation',
  'Traffic and Parking',
  'General Welfare',
]

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })

export default function PublicOrdinances() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [selected, setSelected] = useState(null)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['public-ordinances'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ordinances')
        .select('id, ordinance_no, title, category, date_enacted, summary, sponsor, file_url')
        .eq('is_active', true)
        .order('date_enacted', { ascending: false })
      return data || []
    },
  })

  const filtered = useMemo(() => {
    return items.filter(o => {
      const matchesCategory = category === 'All' || o.category === category
      const q = search.trim().toLowerCase()
      const matchesSearch = !q || o.title.toLowerCase().includes(q) || o.ordinance_no.toLowerCase().includes(q)
      return matchesCategory && matchesSearch
    })
  }, [items, search, category])

  const countsByCategory = useMemo(() => {
    const counts = {}
    items.forEach(o => { counts[o.category] = (counts[o.category] || 0) + 1 })
    return counts
  }, [items])

  return (
    <div className="public-announcements-page">
      <header className="public-announcements-header">
        <div className="public-announcements-header-inner">
          <a href="/" className="public-announcements-brand" aria-label="Return to PROTECT home">
            <span className="public-announcements-brand-mark"><ScrollText size={19} aria-hidden="true" /></span>
            <span>
              <strong>Barangay San Joaquin</strong>
              <small>Ordinance archive</small>
            </span>
          </a>
          <a href="/announcements" className="public-announcements-needs-button">
            <FileText size={16} aria-hidden="true" />
            Community bulletin
          </a>
        </div>
      </header>

      <main className="public-announcements-main">
        <section className="public-announcements-intro">
          <div>
            <p className="public-announcements-eyebrow">Public record</p>
            <h1>Barangay ordinance archive</h1>
            <p className="public-announcements-intro-copy">
              Search and browse ordinances enacted by the Sangguniang Barangay of San Joaquin.
            </p>
          </div>
          <div className="public-announcements-status">
            <span className="public-announcements-status-dot" />
            <span>{items.length} enacted {items.length === 1 ? 'ordinance' : 'ordinances'}</span>
          </div>
        </section>

        {/* Search + category filter bar */}
        <section className="public-ordinance-filterbar">
          <div className="public-ordinance-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="text"
              placeholder="Search by title or ordinance no..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="public-ordinance-categories">
            <button
              className={category === 'All' ? 'public-ordinance-chip active' : 'public-ordinance-chip'}
              onClick={() => setCategory('All')}
            >
              All ({items.length})
            </button>
            {CATEGORIES.map(c => (
              <button
                key={c}
                className={category === c ? 'public-ordinance-chip active' : 'public-ordinance-chip'}
                onClick={() => setCategory(c)}
              >
                {c} ({countsByCategory[c] || 0})
              </button>
            ))}
          </div>
        </section>

        {isLoading ? (
          <div className="public-announcements-empty" role="status">Loading ordinances...</div>
        ) : filtered.length === 0 ? (
          <div className="public-announcements-empty">
            <ScrollText size={26} aria-hidden="true" />
            <strong>No ordinances found.</strong>
            <span>Try a different search term or category.</span>
          </div>
        ) : (
          <section className="public-ordinance-table-wrap">
            <table className="public-ordinance-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Date Enacted</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <tr key={o.id} onClick={() => setSelected(o)} tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(o) } }}>
                    <td className="public-ordinance-no">{o.ordinance_no}</td>
                    <td className="public-ordinance-title">{o.title}</td>
                    <td><span className="public-ordinance-category-pill">{o.category}</span></td>
                    <td className="public-ordinance-date"><CalendarDays size={13} aria-hidden="true" /> {formatDate(o.date_enacted)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>

      <footer className="public-announcements-footer">
        <span>Powered by PROTECT</span>
        <span>Barangay San Joaquin Intelligence System</span>
      </footer>

      {selected && (
        <div className="public-announcement-detail-modal" onClick={() => setSelected(null)}>
          <article className="public-announcement-detail-dialog public-ordinance-detail" role="dialog" aria-modal="true" aria-labelledby="ordinance-detail-title" onClick={event => event.stopPropagation()}>
            <button className="public-announcement-detail-close" type="button" onClick={() => setSelected(null)} aria-label="Close ordinance details"><X size={18} /></button>
            <div className="public-announcement-detail-dialog-body">
              <div className="public-announcement-meta-row">
                <span className="public-ordinance-category-pill">{selected.category}</span>
                <span className="public-announcement-date"><CalendarDays size={14} aria-hidden="true" /> {formatDate(selected.date_enacted)}</span>
              </div>
              <p style={{ fontSize: 12, color: '#8996a0', fontWeight: 600, margin: '10px 0 2px' }}>Ordinance No. {selected.ordinance_no}</p>
              <h2 id="ordinance-detail-title">{selected.title}</h2>
              {selected.summary && <p>{selected.summary}</p>}
              {selected.sponsor && (
                <p style={{ fontSize: 12.5, color: '#647481', marginTop: 10 }}>Sponsored by: {selected.sponsor}</p>
              )}
              <span className="public-announcement-detail-source"><Info size={14} aria-hidden="true" /> Official barangay ordinance</span>
              {selected.file_url && (
                <a href={selected.file_url} target="_blank" rel="noopener noreferrer" className="public-ordinance-download">
                  <Download size={14} aria-hidden="true" /> Download signed PDF copy
                </a>
              )}
            </div>
          </article>
        </div>
      )}
    </div>
  )
}
