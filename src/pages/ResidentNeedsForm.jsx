import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { toast } from 'react-toastify'
import { sanitizeSurveyForm } from '../lib/sanitize'

export default function ResidentNeedsForm() {
  const qc = useQueryClient()
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ purok: 'Sitio Hunan', priority_need: 'Health Services', comments: '' })

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
    mutationFn: async (payload) => {
      const { error } = await supabase.from('survey_responses').insert(payload)
      if (error) throw error
    },
    onSuccess: () => {
      setSubmitted(true)
      qc.invalidateQueries({ queryKey: ['survey-responses'] })
      setTimeout(() => {
        setForm({ purok: 'Sitio Hunan', priority_need: 'Health Services', comments: '' })
        setSubmitted(false)
      }, 3000)
    },
    onError: (e) => toast.error(e.message),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const sanitized = sanitizeSurveyForm(form)
    submitMutation.mutate(sanitized)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0D9E8C 0%, #1A3A5C 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: 500, background: '#fff', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #0D9E8C 0%, #1A3A5C 100%)', color: '#fff', padding: '32px 28px', textAlign: 'center' }}>
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
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: 14,
                    border: '1px solid #E2E8F0',
                    borderRadius: '6px',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {needOptions.map((option) => (
                    <button
                      key={option.need}
                      type="button"
                      onClick={() => setForm({ ...form, priority_need: option.need })}
                      style={{
                        padding: '12px 14px',
                        border: form.priority_need === option.need ? '2px solid #0D9E8C' : '1px solid #E2E8F0',
                        background: form.priority_need === option.need ? '#0D9E8C15' : '#fff',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 500,
                        color: '#1A3A5C',
                        transition: 'all 0.15s',
                        textAlign: 'center',
                      }}
                      onMouseEnter={(e) => {
                        if (form.priority_need !== option.need) {
                          e.target.style.borderColor = '#0D9E8C'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (form.priority_need !== option.need) {
                          e.target.style.borderColor = '#E2E8F0'
                        }
                      }}
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
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: 14,
                    border: '1px solid #E2E8F0',
                    borderRadius: '6px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    minHeight: '80px',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#0D9E8C'}
                  onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitMutation.isPending}
                style={{
                  padding: '14px 20px',
                  background: '#0D9E8C',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: submitMutation.isPending ? 'not-allowed' : 'pointer',
                  opacity: submitMutation.isPending ? 0.6 : 1,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!submitMutation.isPending) {
                    e.target.style.background = '#0a7a6a'
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#0D9E8C'
                }}
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
    </div>
  )
}
