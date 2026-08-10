import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ClipboardList, Info, Megaphone, ArrowUpRight, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import NeedsForm from '../components/NeedsForm'

const CATEGORY_STYLES = {
  General: 'public-announcement-category general',
  Health: 'public-announcement-category health',
  Safety: 'public-announcement-category safety',
  Event: 'public-announcement-category event',
  Disaster: 'public-announcement-category disaster',
  Others: 'public-announcement-category others',
}

const formatDate = (value, options = { month: 'short', day: 'numeric', year: 'numeric' }) =>
  new Date(value).toLocaleDateString('en-PH', options)

function Detail({ icon: Icon, label, children }) {
  return (
    <div className="public-announcement-detail">
      <Icon size={15} strokeWidth={2} aria-hidden="true" />
      <div>
        <span>{label}</span>
        <p>{children}</p>
      </div>
    </div>
  )
}

function AnnouncementImage({ item, featured = false }) {
  if (!item.image_url) return null

  return (
    <div className={featured ? 'public-announcement-image featured' : 'public-announcement-image'}>
      <img src={item.image_url} alt="" />
    </div>
  )
}

export default function PublicAnnouncements() {
  const [showNeedsForm, setShowNeedsForm] = useState(false)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['public-announcements'],
    queryFn: async () => {
      const { data } = await supabase
        .from('announcements')
        .select('id, title, body, category, created_at, image_url')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      return data || []
    },
  })

  const announcements = items

  return (
    <div className="public-announcements-page">
      <header className="public-announcements-header">
        <div className="public-announcements-header-inner">
          <a href="/" className="public-announcements-brand" aria-label="Return to PROTECT home">
            <span className="public-announcements-brand-mark"><Megaphone size={19} aria-hidden="true" /></span>
            <span>
              <strong>Barangay San Joaquin</strong>
              <small>Community bulletin</small>
            </span>
          </a>
          <button className="public-announcements-needs-button" onClick={() => setShowNeedsForm(true)}>
            <ClipboardList size={16} aria-hidden="true" />
            Submit your needs
          </button>
        </div>
      </header>

      <main className="public-announcements-main">
        <section className="public-announcements-intro">
          <div>
            <p className="public-announcements-eyebrow">Stay informed</p>
            <h1>Community announcements</h1>
            <p className="public-announcements-intro-copy">
              Official news, public advisories, and upcoming activities from your barangay.
            </p>
          </div>
          <div className="public-announcements-status">
            <span className="public-announcements-status-dot" />
            <span>{items.length} {items.length === 1 ? 'active notice' : 'active notices'}</span>
          </div>
        </section>

        {isLoading ? (
          <div className="public-announcements-empty" role="status">Loading announcements...</div>
        ) : announcements.length === 0 ? (
          <div className="public-announcements-empty">
            <Megaphone size={26} aria-hidden="true" />
            <strong>No announcements posted yet.</strong>
            <span>Check back soon for updates from Barangay San Joaquin.</span>
          </div>
        ) : (
          <>
            <section className="public-announcement-archive" aria-labelledby="archive-heading">
              <div className="public-announcement-section-heading">
                <div>
                  <p className="public-announcements-eyebrow">Latest updates</p>
                  <h2 id="archive-heading">Announcements</h2>
                </div>
                <span>Latest first</span>
              </div>

              <article className="public-announcement-featured" role="article" onClick={() => setSelectedAnnouncement(announcements[0])}>
                <div className="public-announcement-featured-content">
                  <div className="public-announcement-meta-row">
                    <span className={CATEGORY_STYLES[announcements[0].category] || CATEGORY_STYLES.Others}>{announcements[0].category}</span>
                    <span className="public-announcement-date"><CalendarDays size={14} aria-hidden="true" /> {formatDate(announcements[0].created_at)}</span>
                  </div>
                  <h2>{announcements[0].title}</h2>
                  <p className="public-announcement-body">{announcements[0].body}</p>
                  <div className="public-announcement-featured-footer">
                    <span>Read the full announcement</span>
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </div>
                </div>
                <AnnouncementImage item={announcements[0]} featured />
              </article>

              <div className="public-announcement-list">
                {announcements.slice(1).map(item => (
                  <article
                    className={`public-announcement-card${item.image_url ? '' : ' no-image'}`}
                    key={item.id}
                    role="button"
                    tabIndex="0"
                    onClick={() => setSelectedAnnouncement(item)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedAnnouncement(item)
                      }
                    }}
                  >
                    <div className="public-announcement-card-main">
                      <div className="public-announcement-meta-row">
                        <span className={CATEGORY_STYLES[item.category] || CATEGORY_STYLES.Others}>{item.category}</span>
                        <span className="public-announcement-date"><CalendarDays size={14} aria-hidden="true" /> {formatDate(item.created_at)}</span>
                      </div>
                      <h3>{item.title}</h3>
                      <div className="public-announcement-card-what">
                        <span>What:</span>
                        <p className="public-announcement-body">{item.body}</p>
                      </div>
                      {item.image_url && (
                        <div className="public-announcement-card-image">
                          <img src={item.image_url} alt="" />
                        </div>
                      )}
                      <span className="public-announcement-card-footer">
                        <span>View notice details</span>
                        <ArrowUpRight size={15} aria-hidden="true" />
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="public-announcements-footer">
        <span>Powered by PROTECT</span>
        <span>Barangay San Joaquin Intelligence System</span>
      </footer>

      {showNeedsForm && (
        <div className="public-announcements-modal" onClick={() => setShowNeedsForm(false)}>
          <div onClick={event => event.stopPropagation()}>
            <NeedsForm onClose={() => setShowNeedsForm(false)} />
          </div>
        </div>
      )}

      {selectedAnnouncement && (
        <div className="public-announcement-detail-modal" onClick={() => setSelectedAnnouncement(null)}>
          <article className="public-announcement-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="announcement-detail-title" onClick={event => event.stopPropagation()}>
            <button className="public-announcement-detail-close" type="button" onClick={() => setSelectedAnnouncement(null)} aria-label="Close announcement details"><X size={18} /></button>
            <div className="public-announcement-detail-dialog-body">
              <div className="public-announcement-meta-row">
                <span className={CATEGORY_STYLES[selectedAnnouncement.category] || CATEGORY_STYLES.Others}>{selectedAnnouncement.category}</span>
                <span className="public-announcement-date"><CalendarDays size={14} aria-hidden="true" /> {formatDate(selectedAnnouncement.created_at)}</span>
              </div>
              <h2 id="announcement-detail-title">{selectedAnnouncement.title}</h2>
              <p>{selectedAnnouncement.body}</p>
              <span className="public-announcement-detail-source"><Info size={14} aria-hidden="true" /> Official barangay notice</span>
            </div>
            <AnnouncementImage item={selectedAnnouncement} featured />
          </article>
        </div>
      )}
    </div>
  )
}
