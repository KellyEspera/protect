import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { toast } from 'react-toastify'
import { checkRateLimit, recordFailedAttempt, clearAttempts, formatLockoutTime } from '../lib/rateLimiter'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [lockoutInfo, setLockoutInfo] = useState(null)
  const [attemptsLeft, setAttemptsLeft] = useState(null)
  const { signIn } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!lockoutInfo) return
    const interval = setInterval(() => {
      const check = checkRateLimit(email)
      if (check.allowed) { setLockoutInfo(null); setAttemptsLeft(null); clearInterval(interval) }
      else setLockoutInfo(check)
    }, 1000)
    return () => clearInterval(interval)
  }, [lockoutInfo, email])

  const handleLogin = async (e) => {
    e.preventDefault()
    const limitCheck = checkRateLimit(email)
    if (!limitCheck.allowed) { setLockoutInfo(limitCheck); toast.error(`Too many failed attempts. Try again in ${limitCheck.remainingMin} min.`); return }
    setLoading(true)
    try {
      await signIn(email, password)
      clearAttempts(email)
      navigate('/')
    } catch (err) {
      const result = recordFailedAttempt(email)
      if (result.isLocked) { setLockoutInfo({ remainingMs: 15 * 60 * 1000, remainingMin: 15 }); toast.error('Account locked after 5 failed attempts. Try again in 15 minutes.') }
      else { setAttemptsLeft(result.attemptsLeft); toast.error(result.attemptsLeft > 0 ? `Incorrect credentials. ${result.attemptsLeft} attempt${result.attemptsLeft !== 1 ? 's' : ''} remaining.` : 'Login failed.') }
    } finally { setLoading(false) }
  }
  const isLocked = !!lockoutInfo

  return (
    <div style={{ minHeight: '100vh', background: '#0F2740', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' }}>

      {/* Background pattern */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: 'repeating-linear-gradient(45deg, #C9A84C 0, #C9A84C 1px, transparent 0, transparent 50%)', backgroundSize: '24px 24px' }} />

      {/* Side accent line */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: 'linear-gradient(to bottom, #C9A84C, #E8C96A, #C9A84C)' }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>

        {/* Header seal */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #C9A84C 0%, #E8C96A 50%, #C9A84C 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, margin: '0 auto 14px', boxShadow: '0 0 0 4px rgba(201,168,76,0.2), 0 0 0 8px rgba(201,168,76,0.08)' }}>🛡️</div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, color: '#fff', letterSpacing: '0.06em' }}>PROTECT</div>
          <div style={{ fontSize: 11, color: 'rgba(201,168,76,0.8)', textTransform: 'uppercase', letterSpacing: '0.2em', marginTop: 4 }}>Barangay Intelligence System</div>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 6, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>

          {/* Card header band */}
          <div style={{ background: '#1A3A5C', borderBottom: '3px solid #C9A84C', padding: '14px 24px' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Authorized Personnel Only</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>Barangay San Joaquin · Basco, Batanes</div>
          </div>

          <div style={{ padding: '24px 28px 28px' }}>

            {/* Lockout banner */}
            {isLocked && (
              <div style={{ background: '#FCE8E8', border: '1px solid #F4BABA', borderRadius: 4, padding: '10px 14px', marginBottom: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#8B1A1A' }}>🔒 Access Temporarily Suspended</div>
                <div style={{ fontSize: 11, color: '#A03030', marginTop: 4 }}>Too many failed attempts. Please wait: <strong style={{ fontFamily: 'monospace' }}>{formatLockoutTime(lockoutInfo.remainingMs)}</strong></div>
              </div>
            )}

            {/* Attempts warning */}
            {!isLocked && attemptsLeft !== null && attemptsLeft <= 2 && (
              <div style={{ background: '#FBF3DC', border: '1px solid #E8D898', borderRadius: 4, padding: '10px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#7A5C00' }}>⚠ Warning: {attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining before lockout</div>
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>User ID / Email</label>
                <input type="email" className="form-input" placeholder="officer@sanjoaquin.gov.ph" value={email} onChange={e => setEmail(e.target.value)} disabled={isLocked} required style={{ opacity: isLocked ? 0.5 : 1 }} />
              </div>
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>Password</label>
                <input type="password" className="form-input" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} disabled={isLocked} required style={{ opacity: isLocked ? 0.5 : 1 }} />
              </div>
              <button type="submit" disabled={loading || isLocked} style={{ marginTop: 4, padding: '11px 0', background: isLocked ? '#9AA8B8' : '#1A3A5C', color: '#fff', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: isLocked ? 'not-allowed' : 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase', transition: 'background 0.15s', borderBottom: isLocked ? 'none' : '2px solid #C9A84C' }}>
                {loading ? 'Verifying...' : isLocked ? '🔒 Access Suspended' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
            PROTECT v1.0 · Batanes State College · Capstone 2026
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>
            RA 10173 Data Privacy Act Compliant
          </div>
        </div>
      </div>
    </div>
  )
}