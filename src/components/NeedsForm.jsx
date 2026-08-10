import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { toast } from 'react-toastify'
import { sanitizeSurveyForm } from '../lib/sanitize'
import { Camera, Check, ChevronDown, CircleCheck, ClipboardList, MapPin, Paperclip, Send, X } from 'lucide-react'

// Reusable Community Needs form card.
// Used by the standalone /resident-needs page AND embedded in the public
// announcements portal (as a modal). Renders the white card only — the parent
// provides the page background or modal overlay.
export default function NeedsForm({ onClose }) {
  const qc = useQueryClient()
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ sitio: 'Sitio Hunan', priority_need: 'Health Services', comments: '' })
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
    { need: 'Health Services', icon: 'Health' },
    { need: 'Road / Infrastructure', icon: 'Roads' },
    { need: 'Educational Support', icon: 'Education' },
    { need: 'Livelihood Programs', icon: 'Livelihood' },
    { need: 'Water Supply', icon: 'Water' },
    { need: 'Peace & Order', icon: 'Safety' },
    { need: 'Others', icon: 'Other' },
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
        setForm({ sitio: 'Sitio Hunan', priority_need: 'Health Services', comments: '' })
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
    <div className="needs-form-card">
      <div className="needs-form-header">
        {onClose && <button className="needs-form-close" onClick={onClose} aria-label="Close"><X size={18} /></button>}
        <div className="needs-form-icon"><ClipboardList size={22} /></div>
        <p className="needs-form-kicker">Barangay San Joaquin</p>
        <h1>Share a community need</h1>
        <p>Tell us what would make the biggest difference in your area.</p>
      </div>

      <div className="needs-form-content">
        {submitted ? (
          <div className="needs-form-success" role="status">
            <div className="needs-form-success-icon"><CircleCheck size={30} /></div>
            <h2>Thank you for speaking up.</h2>
            <p>Your response has been recorded and will help guide barangay priorities.</p>
            <small>This form will reset in a moment.</small>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="needs-form-fields">
            <div className="needs-form-field">
              <label htmlFor="needs-sitio"><MapPin size={15} /> Your sitio</label>
              <div className="needs-form-select-wrap">
                <select id="needs-sitio" value={form.sitio} onChange={(e) => setForm({ ...form, sitio: e.target.value })}>
                  <option value="Sitio Hunan">Sitio Hunan</option>
                  <option value="Sitio Hagu">Sitio Hagu</option>
                  <option value="Sitio Tuva">Sitio Tuva</option>
                </select>
                <ChevronDown size={16} aria-hidden="true" />
              </div>
            </div>

            <fieldset className="needs-form-field">
              <legend>What is your top priority need?</legend>
              <div className="needs-form-options">
                {needOptions.map(option => {
                  const selected = form.priority_need === option.need
                  return (
                    <button key={option.need} type="button" className={`needs-form-option${selected ? ' selected' : ''}`} onClick={() => setForm({ ...form, priority_need: option.need })} aria-pressed={selected}>
                      <span>{option.icon}</span>
                      {option.need}
                      {selected && <Check size={14} aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <div className="needs-form-field">
              <label htmlFor="needs-comments">Additional comments <span>(optional)</span></label>
              <textarea id="needs-comments" value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} placeholder="Tell us more about this need..." />
            </div>

            <div className="needs-form-field">
              <label><Camera size={15} /> Add a photo <span>(optional)</span></label>
              <p className="needs-form-help">A photo can help us understand the situation. Maximum 5MB.</p>
              {photoPreview ? (
                <div className="needs-form-preview">
                  <img src={photoPreview} alt="Selected need" />
                  <button type="button" onClick={clearPhoto} aria-label="Remove photo"><X size={15} /></button>
                </div>
              ) : (
                <label className="needs-form-upload">
                  <Paperclip size={16} /> Choose a photo
                  <input type="file" accept="image/*" onChange={handlePhoto} />
                </label>
              )}
            </div>

            <button className="needs-form-submit" type="submit" disabled={submitMutation.isPending}>
              <Send size={16} /> {submitMutation.isPending ? 'Submitting...' : 'Submit my needs'}
            </button>
          </form>
        )}
      </div>

      <div className="needs-form-footer">Your feedback helps us serve the community better.</div>
    </div>
  )
}
