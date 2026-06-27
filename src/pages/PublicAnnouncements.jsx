// ============================================================================
//  PublicAnnouncements.jsx  —  the public bulletin board at /announcements
// ----------------------------------------------------------------------------
//  A PUBLIC page (no login) where residents read active announcements, styled
//  as a corkboard of pinned notices, and can open the Community Needs form to
//  submit their priority needs. Only reads announcements where is_active = true.
// ============================================================================

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import NeedsForm from '../components/NeedsForm'

const CAT_COLOR = {
  General:  { bg: '#F0F7FF', color: '#3B82F6' },
  Health:   { bg: '#E8F8F4', color: '#0D9E8C' },
  Safety:   { bg: '#FFF0F0', color: '#B83232' },
  Event:    { bg: '#FFF9EB', color: '#B8860B' },
  Disaster: { bg: '#FFF0E8', color: '#C2522A' },
  Others:   { bg: '#F5F2EC', color: '#5A5A52' },
}

// Pushpin colours cycle per note, slight tilt for a real bulletin-board feel
const PIN_COLORS = ['#D14545', '#3B82F6', '#0D9E8C', '#C9A84C', '#A855F7', '#EC4899']
const TILTS = [-2.5, 1.5, -1, 2, -2, 1.2, -1.6]
// Paper note tints
const PAPER = ['#FFFEF7', '#FFFDF0', '#FEFCF5']

function Pin({ color }) {
  return (
    <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', zIndex: 3 }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        background: `radial-gradient(circle at 35% 30%, #fff 0%, ${color} 45%, ${color} 100%)`,
        boxShadow: '0 3px 5px rgba(0,0,0,0.35)', border: '1px solid rgba(0,0,0,0.15)',
      }} />
    </div>
  )
}

export default function PublicAnnouncements() {
  const [showNeedsForm, setShowNeedsForm] = useState(false)

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

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'Inter, sans-serif', background: '#6B4E2E' }}>
      {/* Header */}
      <div style={{ background: '#1A3A5C', borderBottom: '4px solid #C9A84C', padding: '24px 0' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, background: '#C9A84C', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📢</div>
            <div>
              <h1 style={{ margin: 0, color: '#fff', fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700 }}>
                Barangay Bulletin Board
              </h1>
              <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
                Barangay San Joaquin · Basco, Batanes
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowNeedsForm(true)}
            style={{ background: '#C9A84C', color: '#1A3A5C', border: 'none', borderRadius: 8, padding: '11px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
          >
            📝 Submit Your Needs
          </button>
        </div>
      </div>

      {/* Corkboard */}
      <div style={{
        // wooden frame around the cork
        background: 'linear-gradient(145deg, #8a5a2b, #6b431f)',
        padding: 'clamp(14px, 3vw, 28px)',
      }}>
        <div style={{
          // cork surface — tan with a speckled texture
          minHeight: 500,
          borderRadius: 6,
          padding: 'clamp(20px, 4vw, 40px) clamp(16px, 3vw, 32px)',
          background: '#C9A66B',
          backgroundImage: `
            radial-gradient(circle at 50% 50%, rgba(120,80,40,0.35) 1px, transparent 1.4px),
            radial-gradient(circle at 50% 50%, rgba(90,60,30,0.25) 1px, transparent 1.4px)`,
          backgroundSize: '12px 12px, 19px 19px',
          backgroundPosition: '0 0, 7px 9px',
          boxShadow: 'inset 0 0 60px rgba(80,50,20,0.45)',
        }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#5A3E22', fontSize: 14, fontWeight: 600 }}>
              Loading announcements...
            </div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <p style={{ color: '#5A3E22', fontSize: 15, fontWeight: 600 }}>No announcements posted yet.</p>
              <p style={{ color: '#7A5A38', fontSize: 12 }}>Check back soon for updates from Barangay San Joaquin.</p>
            </div>
          ) : (
            // Masonry-style columns so notes pin at varied heights
            <div style={{ columnWidth: 300, columnGap: 'clamp(18px, 3vw, 30px)', maxWidth: 1100, margin: '0 auto' }}>
              {items.map((item, i) => {
                const cat = CAT_COLOR[item.category] || CAT_COLOR.Others
                const pin = PIN_COLORS[i % PIN_COLORS.length]
                const tilt = TILTS[i % TILTS.length]
                const paper = PAPER[i % PAPER.length]
                return (
                  <div
                    key={item.id}
                    style={{ breakInside: 'avoid', display: 'inline-block', width: '100%', marginBottom: 'clamp(20px, 4vw, 34px)', paddingTop: 12 }}
                  >
                    <div style={{
                      position: 'relative',
                      background: paper,
                      borderRadius: 3,
                      padding: 0,
                      transform: `rotate(${tilt}deg)`,
                      boxShadow: '0 6px 16px rgba(40,25,10,0.4)',
                      border: '1px solid rgba(0,0,0,0.06)',
                    }}>
                      <Pin color={pin} />

                      <div style={{ padding: '18px 18px 6px' }}>
                        <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: cat.bg, color: cat.color, marginBottom: 8 }}>
                          {item.category}
                        </span>
                        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1A1A2E', fontFamily: 'Georgia, serif', lineHeight: 1.3 }}>
                          {item.title}
                        </h2>
                      </div>

                      {item.image_url && (
                        <div style={{ padding: '8px 14px 0' }}>
                          <img
                            src={item.image_url}
                            alt={item.title}
                            style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)' }}
                          />
                        </div>
                      )}

                      <div style={{ padding: '10px 18px 14px', fontSize: 13, color: '#3A3A3A', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                        {item.body}
                      </div>

                      <div style={{ padding: '0 18px 14px', fontSize: 11, color: '#9A8C72', borderTop: '1px dashed #E2D9C5', paddingTop: 8, marginTop: 2 }}>
                        📅 {new Date(item.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.6)', padding: '18px 0', background: '#6B4E2E' }}>
        Powered by PROTECT · Barangay San Joaquin Intelligence System
      </p>

      {/* Needs form modal */}
      {showNeedsForm && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,39,64,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}
          onClick={() => setShowNeedsForm(false)}
        >
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 500, margin: 'auto' }}>
            <NeedsForm onClose={() => setShowNeedsForm(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
