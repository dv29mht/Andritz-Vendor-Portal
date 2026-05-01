import { useState, useEffect } from 'react'
import { Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { authService } from '../services/authService'
import AndritzLogo from '../../../shared/components/AndritzLogo'

function LeftPanel() {
  return (
    <div
      className="hidden lg:flex lg:w-[48%] xl:w-1/2 flex-col justify-between p-14 relative overflow-hidden login-bg-animate"
      style={{ background: 'linear-gradient(145deg, #064e80 0%, #096fb3 45%, #075d99 75%, #053e66 100%)' }}
    >
      <svg className="absolute inset-0 w-full h-full opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.8"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      <div className="absolute -top-24 -right-24 w-[380px] h-[380px] rounded-full border border-white/10" />
      <div className="absolute -top-12 -right-12 w-[260px] h-[260px] rounded-full border border-white/10" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full bg-white/5 -translate-x-1/2 translate-y-1/2" />
      <div className="absolute top-1/2 right-0 w-48 h-48 rounded-full bg-[#096fb3]/30 translate-x-1/2 -translate-y-1/2" />
      <div className="relative z-10">
        <AndritzLogo white className="h-8 w-auto" />
        <p className="text-white/50 text-[9px] font-semibold tracking-[0.3em] uppercase mt-2">
          Supplier Onboarding Tool
        </p>
      </div>
      <div className="relative z-10">
        <div className="w-8 h-0.5 mb-8" style={{ background: '#096fb3' }} />
        <h1 className="text-white font-bold leading-[1.1] mb-6" style={{ fontSize: '2.8rem' }}>
          Streamlined<br />supplier<br />onboarding.
        </h1>
        <p className="text-white/50 text-sm leading-relaxed max-w-[280px] mb-10">
          Multi-step approvals, real-time tracking, and SAP vendor code assignment — all in one compliance-ready tool.
        </p>
        <div className="flex gap-8">
          {[['Multi-step', 'Approvals'], ['Real-time', 'Tracking'], ['SAP', 'Integration']].map(([top, bot]) => (
            <div key={top}>
              <p className="text-white text-sm font-bold">{top}</p>
              <p className="text-white/40 text-xs">{bot}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="relative z-10">
        <p className="text-white/25 text-[11px] tracking-wide">
          © {new Date().getFullYear()} Andritz India Private Limited. All rights reserved.
        </p>
      </div>
    </div>
  )
}

// ── Forgot Password view ──────────────────────────────────────────────────────
function ForgotPasswordView({ onBack }) {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authService.forgotPassword(email)
      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-4 w-0.5 rounded-full" style={{ background: '#096fb3' }} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: '#096fb3' }}>
            Supplier Onboarding Tool
          </span>
        </div>
        <h2 className="text-[1.9rem] font-bold text-gray-900 tracking-tight leading-tight">
          Forgot password
        </h2>
        <p className="text-sm text-gray-400 mt-1.5">
          Enter your email and we'll send you a reset link.
        </p>
      </div>
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200/80 p-8">
        {sent ? (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-gray-600">If that email is registered, a reset link has been sent. Check your inbox.</p>
            <button onClick={onBack} className="text-sm font-medium" style={{ color: '#096fb3' }}>
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="form-label">Email address</label>
              <input
                type="email"
                className="form-input"
                placeholder="Enter your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-150 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #096fb3, #075d99)' }}
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <button type="button" onClick={onBack} className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </>
  )
}

// ── Reset Password view (landed via email link) ───────────────────────────────
function ResetPasswordView({ email, token }) {
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [showPwd,     setShowPwd]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [done,        setDone]        = useState(false)
  const [error,       setError]       = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      await authService.resetPassword(email, token, password)
      setDone(true)
    } catch (err) {
      setError(err.response?.data?.message ?? 'Reset failed. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-4 w-0.5 rounded-full" style={{ background: '#096fb3' }} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: '#096fb3' }}>
            Supplier Onboarding Tool
          </span>
        </div>
        <h2 className="text-[1.9rem] font-bold text-gray-900 tracking-tight leading-tight">
          Set new password
        </h2>
        <p className="text-sm text-gray-400 mt-1.5">Choose a strong password for your account.</p>
      </div>
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200/80 p-8">
        {done ? (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-gray-600">Password reset successfully!</p>
            <a href="/" className="block text-sm font-medium" style={{ color: '#096fb3' }}>Sign in with new password</a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="form-label">New Password</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="form-input pr-10"
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoFocus
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                  {showPwd ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="form-label">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  className="form-input pr-10"
                  placeholder="Repeat password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                  {showConfirm ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-150 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #096fb3, #075d99)' }}
            >
              {loading ? 'Resetting…' : 'Reset password'}
            </button>
          </form>
        )}
      </div>
    </>
  )
}

// ── Main Login view ───────────────────────────────────────────────────────────
export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from?.pathname ?? '/dashboard'

  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [showPwd,     setShowPwd]     = useState(false)
  const [error,       setError]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [visible,     setVisible]     = useState(false)
  const [view,        setView]        = useState('login') // 'login' | 'forgot'

  if (isAuthenticated) return <Navigate to={redirectTo} replace />

  // Check if this is a reset-password link
  const params     = new URLSearchParams(window.location.search)
  const resetEmail = params.get('email')
  const resetToken = params.get('token')
  const isReset    = !!(resetEmail && resetToken)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 40)
    return () => clearTimeout(t)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err.response?.data?.message ?? 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  const renderRight = () => {
    if (isReset)
      return <ResetPasswordView email={resetEmail} token={resetToken} />
    if (view === 'forgot')
      return <ForgotPasswordView onBack={() => setView('login')} />
    return (
      <>
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-4 w-0.5 rounded-full" style={{ background: '#096fb3' }} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: '#096fb3' }}>
              Supplier Onboarding Tool
            </span>
          </div>
          <h2 className="text-[1.9rem] font-bold text-gray-900 tracking-tight leading-tight">
            Welcome back
          </h2>
          <p className="text-sm text-gray-400 mt-1.5">
            Sign in with your Andritz credentials to continue.
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200/80 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="form-label">Email address</label>
              <input
                type="email"
                className="form-input"
                placeholder="Enter email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="form-label">
                <span>Password</span>
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="form-input pr-10"
                  placeholder="Enter password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPwd ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </button>
              </div>
              <div className="flex justify-end mt-1.5">
                <button
                  type="button"
                  onClick={() => setView('forgot')}
                  className="text-xs hover:underline transition-colors"
                  style={{ color: '#096fb3' }}
                >
                  Forgot password?
                </button>
              </div>
            </div>
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 ring-1 ring-red-200 px-3 py-2.5">
                <svg className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                </svg>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-150 disabled:opacity-60 mt-1"
              style={{ background: 'linear-gradient(135deg, #096fb3, #075d99)' }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </>
              ) : 'Sign in'}
            </button>
          </form>
        </div>
        <p className="text-center text-[11px] font-semibold text-gray-400 mt-5">
          Access restricted to authorised Andritz personnel only.
        </p>
      </>
    )
  }

  return (
    <div className="min-h-screen flex">
      <LeftPanel />
      <div className="flex-1 flex flex-col bg-[#f7f8fa] min-h-screen">
        <div className="lg:hidden flex items-center gap-3 px-6 py-4" style={{ background: '#064e80' }}>
          <AndritzLogo white className="h-5 w-auto" />
          <div className="h-4 w-px bg-white/20 mx-1" />
          <span className="text-white/60 text-xs font-semibold tracking-widest uppercase">Supplier Onboarding Tool</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-6 lg:p-16">
          <div className={`w-full max-w-[400px] transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {renderRight()}
          </div>
        </div>
      </div>
    </div>
  )
}
