import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { toast } from 'react-toastify'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuthStore()
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/')
    } catch (err) {
      toast.error(err.message || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-10 w-full max-w-sm shadow-2xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-teal rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3">🛡️</div>
          <h1 className="font-display text-2xl font-bold text-navy">PROTECT</h1>
          <p className="text-xs text-gray-400 mt-1">Integrated Barangay Analytics & Community Intelligence</p>
          <p className="text-[11px] text-gray-300 mt-0.5">Barangay Kayvaluganan, Basco, Batanes</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input mt-1"
              placeholder="officer@brgykayvaluganan.gov.ph"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input mt-1"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full py-3 mt-2 text-sm font-semibold disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign In to PROTECT'}
          </button>
        </form>

        <p className="text-center text-[11px] text-gray-300 mt-6">
          PROTECT v1.0 &bull; Batanes State College Capstone 2026
        </p>
      </div>
    </div>
  )
}
