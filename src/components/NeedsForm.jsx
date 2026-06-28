import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { toast } from 'react-toastify'
import { sanitizeSurveyForm } from '../lib/sanitize'

// Reusable Community Needs form card.
// Used by the standalone /resident-needs page AND embedded in the public
// announcements portal (as a modal). Renders the white card only — the parent
// provides the page background or modal overlay.
export default function NeedsForm({ onClose }) {
  const qc = useQueryClient()
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ purok: 'Sitio Hunan', priority_need: 'Health Services', comments: '' })
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)

  // Validate & preview an attached photo (images only, max 5MB)
  const handlePhoto = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file.'); e.target.value = ''; return }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be 5MB or smaller.'); e.target.value = ''; return }
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }
  const clearPhoto = () => { setPhotoFile(null); setPhotoPreview(null) }

  const needOptions = [
    { need: 'Health Services', icon: '🏥' },
    { need: 'Road / Infrastructure', icon: '🛣️' },
    { need: 'Educational Support', icon: '🎓' },
    { need: 'Livelihood Programs', icon: '💼' },
    { need: 'Water Supply', icon: '💧' },
    { need: 'Peace & Order', icon: '🚔' },
    { need: 'Others', icon: '📌' },
  ]

  const submitMutation = useMutation({
    mutationFn: async ({ payload, file }) => {
      // Upload the optional photo first, then store its public URL on the row.
      let photo_url = null
      if (file) {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { error: upErr } = await supabase.storage.from('needs-photos').upload(path, file, { upsert: false })
        if (upErr) throw upErr
        photo_url = supabase.storage.from('needs-photos').getPublicUrl(path).data.publicUrl
      }
      const { error } = await supabase.from('survey_responses').insert({ ...payload, photo_url })
      if (error) throw error
    },
    onSuccess: () => {
      setSubmitted(true)
      qc.invalidateQueries({ queryKey: ['survey-responses'] })
      setTimeout(() => {
        setForm({ purok: 'Sitio Hunan', priority_need: 'Health Services', comments: '' })
        clearPhoto()
        setSubmitted(false)
      }, 3000)
    },
    onError: (e) => toast.error(e.message),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const sanitized = sanitizeSurveyForm(form)
    submitMutation.mutate({ payload: sanitized, file: photoFile })
  }

  return (
    <div style={{ width: '100%', maxWidth: 500, background: '#fff', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ position: 'relative', background: 'linear-gradient(135deg, #0D9E8C 0%, #1A3A5C 100%)', color: '#fff', padding: '32px 28px', textAlign: 'center' }}>
        {onClose && (
          <button
            onClick={onClose}
            style={{ position: 'absolute', top: 14, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
            aria-label="Close"
          >
            &times;
          </button>
        )}
        <div style={{ fontSize: 40, marginBottom: 12 }}>🛡️</div>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0, marginBottom: 8 }}>Community Needs</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', margin: 0, marginBottom: 4 }}>Barangay San Joaquin</p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0 }}>Share your priority needs with us</p>
      </div>

      {/* Content */}
      <div style={{ padding: '32px 28px' }}>
        {submitted ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: '#1A3A5C', margin: 0, marginBottom: 8 }}>Thank You!</h2>
            <p style={{ fontSize: 14, color: '#666', margin: 0, marginBottom: 12 }}>Your response has been recorded.</p>
            <p style={{ fontSize: 12, color: '#999', margin: 0 }}>This form will reset in a moment...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Sitio Selection */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1A3A5C', marginBottom: 8 }}>📍 Your Sitio</label>
              <select
                value={form.purok}
                onChange={(e) => setForm({ ...form, purok: e.target.value })}
                style={{
                  width: '100%', padding: '12px 14px', fontSize: 14,
                  border: '1px solid #E2E8F0', borderRadius: '6px', fontFamily: 'inherit',
                  cursor: 'pointer', transition: 'border-color 0.15s',
                }}
                onFocus={(e) => e.target.style.borderColor = '#0D9E8C'}
                onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
              >
                <option value="Sitio Hunan">Sitio Hunan</option>
                <option value="Sitio Hagu">Sitio Hagu</option>
                <option value="Sitio Tuva">Sitio Tuva</option>
              </select>
            </div>

            {/* Priority Need Selection */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1A3A5C', marginBottom: 8 }}>⭐ What's your top priority need?</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {needOptions.map((option) => (
                  <button
                    key={option.need}
                    type="button"
                    onClick={() => setForm({ ...form, priority_need: option.need })}
                    style={{
                      padding: '12px 14px',
                      border: form.priority_need === option.need ? '2px solid #0D9E8C' : '1px solid #E2E8F0',
                      background: form.priority_need === option.need ? '#0D9E8C15' : '#fff',
                      borderRadius: '6px', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                      color: '#1A3A5C', transition: 'all 0.15s', textAlign: 'center',
                    }}
                    onMouseEnter={(e) => { if (form.priority_need !== option.need) e.target.style.borderColor = '#0D9E8C' }}
                    onMouseLeave={(e) => { if (form.priority_need !== option.need) e.target.style.borderColor = '#E2E8F0' }}
                  >
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{option.icon}</div>
                    <div>{option.need}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Comments */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1A3A5C', marginBottom: 8 }}>💬 Additional Comments (Optional)</label>
              <textarea
                value={form.comments}
                onChange={(e) => setForm({ ...form, comments: e.target.value })}
                placeholder="Tell us more about your community needs..."
                style={{
                  width: '100%', padding: '12px 14px', fontSize: 14,
                  border: '1px solid #E2E8F0', borderRadius: '6px', fontFamily: 'inherit',
                  resize: 'vertical', minHeight: '80px', boxSizing: 'border-box', transition: 'border-color 0.15s',
                }}
                onFocus={(e) => e.target.style.borderColor = '#0D9E8C'}
                onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
              />
            </div>

            {/* Photo (optional) */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1A3A5C', marginBottom: 8 }}>📷 Add a Photo (Optional)</label>
              <p style={{ fontSize: 12, color: '#888', margin: '0 0 8px' }}>e.g. a broken pipe, damaged road, or anything that shows the need.</p>
              {photoPreview ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={photoPreview} alt="preview" style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 6, border: '1px solid #E2E8F0' }} />
                  <button
                    type="button"
                    onClick={clearPhoto}
                    style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(184,50,50,0.92)', color: '#fff', border: 'none', width: 24, height: 24, borderRadius: '50%', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
                    aria-label="Remove photo"
                  >&times;</button>
                </div>
              ) : (
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', border: '1.5px dashed #CBD5E0', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: '#5A5A52' }}>
                  📎 Choose a photo (max 5MB)
                  <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
                </label>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitMutation.isPending}
              style={{
                padding: '14px 20px', background: '#0D9E8C', color: '#fff', border: 'none',
                borderRadius: '6px', fontSize: 14, fontWeight: 600,
                cursor: submitMutation.isPending ? 'not-allowed' : 'pointer',
                opacity: submitMutation.isPending ? 0.6 : 1, transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { if (!submitMutation.isPending) e.target.style.background = '#0a7a6a' }}
              onMouseLeave={(e) => { e.target.style.background = '#0D9E8C' }}
            >
              {submitMutation.isPending ? '⏳ Submitting...' : '✓ Submit My Needs'}
            </button>
          </form>
        )}
      </div>

      {/* Footer */}
      <div style={{ background: '#F5F8FA', borderTop: '1px solid #E2E8F0', padding: '16px 28px', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: '#999', margin: 0 }}>Your feedback helps us serve you better. Thank you!</p>
      </div>
    </div>
  )
}
