import { useState, useEffect } from 'react'
import { Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  EyeIcon, EyeSlashIcon,
  EnvelopeIcon, LockClosedIcon,
  ShieldCheckIcon, CheckBadgeIcon, GlobeAltIcon, LifebuoyIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'
import { authService } from '../services/authService'
import AndritzLogo from '../../../shared/components/AndritzLogo'

const BRAND = '#096fb3'
const BRAND_DARK = '#064e80'

// ── Decorative left-side feature row ──────────────────────────────────────────
function Feature({ icon: Icon, title, desc }) {
  return (
    <div className="flex items-start gap-3.5">
      <div
        className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ring-1 ring-[#096fb3]/15"
        style={{ background: 'rgba(9,111,179,0.10)' }}
      >
        <Icon className="h-[18px] w-[18px]" style={{ color: BRAND_DARK }} />
      </div>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-gray-900 leading-tight">{title}</p>
        <p className="text-[13px] text-gray-600 leading-snug mt-0.5">{desc}</p>
      </div>
    </div>
  )
}

// ── Floating UI accent cards over the marketing background ────────────────────
function FloatingAccents() {
  return (
    <div className="absolute inset-0 pointer-events-none hidden xl:block" aria-hidden="true">
      {/* Pending approvals chip — top right */}
      <div className="absolute top-[14%] right-[10%] bg-white/95 backdrop-blur rounded-xl shadow-lg ring-1 ring-gray-200/70 px-3.5 py-2.5 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-[#fff4e6] flex items-center justify-center">
          <svg className="h-3.5 w-3.5 text-[#d97706]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M9 7a3 3 0 116 0 3 3 0 01-6 0zm8 4a2 2 0 100-4 2 2 0 000 4zm-12 0a2 2 0 100-4 2 2 0 000 4z" />
          </svg>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Pending Approvals</p>
          <p className="text-lg font-bold text-gray-900 leading-none">12</p>
        </div>
      </div>

      {/* Approved vendors card — middle right */}
      <div className="absolute top-[44%] right-[6%] bg-white/95 backdrop-blur rounded-xl shadow-lg ring-1 ring-gray-200/70 px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
          <CheckBadgeIcon className="h-4 w-4 text-emerald-600" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Approved Vendors</p>
          <div className="flex items-baseline gap-1.5">
            <p className="text-lg font-bold text-gray-900 leading-none">248</p>
            <span className="text-[10px] font-semibold text-emerald-600">+18 this week</span>
          </div>
        </div>
      </div>

      {/* Onboarding progress card — lower right */}
      <div className="absolute bottom-[18%] right-[8%] bg-white/95 backdrop-blur rounded-xl shadow-lg ring-1 ring-gray-200/70 px-4 py-3 w-[260px]">
        <p className="text-[11px] font-semibold text-gray-700 mb-2.5">Onboarding Progress</p>
        <div className="flex items-center justify-between">
          {['Invited', 'Documents', 'Review', 'Approved'].map((label, i) => {
            const done = i < 2
            const active = i === 2
            return (
              <div key={label} className="flex flex-col items-center gap-1 relative flex-1">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center ring-2"
                  style={{
                    background: done ? '#10b981' : active ? '#096fb3' : '#e5e7eb',
                    color: 'white',
                    boxShadow: active ? '0 0 0 3px rgba(9,111,179,0.18)' : 'none',
                    borderColor: 'transparent',
                  }}
                >
                  {done ? (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-[9px] font-bold">{i + 1}</span>
                  )}
                </div>
                <p className="text-[9px] font-medium text-gray-600 whitespace-nowrap">{label}</p>
                {i < 3 && (
                  <div
                    className="absolute top-2.5 left-[60%] right-[-40%] h-px"
                    style={{ background: done ? '#10b981' : '#e5e7eb' }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Left marketing panel ──────────────────────────────────────────────────────
function LeftPanel() {
  return (
    <div
      className="hidden lg:flex lg:w-[56%] xl:w-[58%] flex-col justify-between p-12 xl:p-14 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #f1f6fc 0%, #e2ecf7 50%, #cfe0ef 100%)' }}
    >
      {/* Blueprint grid */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.10]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke={BRAND_DARK} strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Soft radial highlights */}
      <div className="absolute -top-20 -left-20 w-[420px] h-[420px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(9,111,179,0.10), transparent 70%)' }} />
      <div className="absolute -bottom-32 -right-10 w-[480px] h-[480px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(9,111,179,0.08), transparent 70%)' }} />

      {/* Decorative connector lines */}
      <svg className="absolute inset-0 w-full h-full opacity-30 hidden xl:block" aria-hidden="true">
        <line x1="55%" y1="22%" x2="78%" y2="18%" stroke={BRAND} strokeWidth="0.7" strokeDasharray="3 4" />
        <line x1="60%" y1="50%" x2="82%" y2="48%" stroke={BRAND} strokeWidth="0.7" strokeDasharray="3 4" />
        <line x1="58%" y1="78%" x2="80%" y2="82%" stroke={BRAND} strokeWidth="0.7" strokeDasharray="3 4" />
      </svg>

      <FloatingAccents />

      {/* Top — brand */}
      <div className="relative z-10">
        <AndritzLogo className="h-9 w-auto" />
        <p className="mt-3 text-[22px] xl:text-[24px] font-semibold tracking-tight" style={{ color: BRAND_DARK }}>
          Supplier Connect
        </p>
      </div>

      {/* Middle — headline + features */}
      <div className="relative z-10 max-w-[520px]">
        <h1 className="text-gray-900 font-bold tracking-tight leading-[1.08] mb-5"
          style={{ fontSize: 'clamp(2rem, 3vw, 2.65rem)' }}>
          Connected supplier<br />
          onboarding, built for<br />
          <span style={{ color: BRAND }}>speed</span> and{' '}
          <span style={{ color: BRAND }}>control</span>.
        </h1>
        <p className="text-gray-600 text-[14px] leading-relaxed mb-8 max-w-[440px]">
          Streamline supplier onboarding, approvals, and collaboration in one secure, enterprise-grade workspace.
        </p>
        <div className="space-y-4">
          <Feature
            icon={ShieldCheckIcon}
            title="Secure onboarding"
            desc="Verify, onboard, and manage suppliers with built-in data security and compliance."
          />
          <Feature
            icon={ApprovalFlowIcon}
            title="Approval workflows"
            desc="Automate multi-level approvals with full visibility and audit trails."
          />
          <Feature
            icon={CollabIcon}
            title="Supplier collaboration"
            desc="Share documents, track requests, and communicate in real time."
          />
          <Feature
            icon={InsightsIcon}
            title="Enterprise visibility"
            desc="Live dashboards and insights to drive better decisions across your supply chain."
          />
        </div>
      </div>

      {/* Bottom — copyright */}
      <div className="relative z-10">
        <p className="text-[11px] text-gray-500 tracking-wide">
          © {new Date().getFullYear()} Andritz India Private Limited. All rights reserved.
        </p>
      </div>
    </div>
  )
}

// ── Custom feature icons (inline SVG so they match the look exactly) ──────────
function ApprovalFlowIcon({ className, style }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
function CollabIcon({ className, style }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}
function InsightsIcon({ className, style }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 14l4-4 3 3 5-6" />
    </svg>
  )
}

// ── Forgot Password view ──────────────────────────────────────────────────────
function ForgotPasswordView({ onBack }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

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
      <div className="mb-7">
        <h2 className="text-[1.75rem] font-bold text-gray-900 tracking-tight leading-tight">
          Forgot password
        </h2>
        <p className="text-sm text-gray-500 mt-1.5">
          Enter your email and we'll send you a reset link.
        </p>
      </div>
      {sent ? (
        <div className="text-center space-y-4 bg-white rounded-2xl ring-1 ring-gray-200/80 p-8">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm text-gray-600">If that email is registered, a reset link has been sent. Check your inbox.</p>
          <button onClick={onBack} className="text-sm font-semibold" style={{ color: BRAND }}>
            Back to sign in
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="form-label">Email address</label>
            <div className="relative">
              <EnvelopeIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="email"
                className="form-input pl-10 py-2.5"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 text-white font-semibold py-2.5 px-4 rounded-lg transition-all disabled:opacity-60"
            style={{ background: BRAND }}
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
          <button type="button" onClick={onBack} className="w-full text-sm text-gray-500 hover:text-gray-700">
            Back to sign in
          </button>
        </form>
      )}
    </>
  )
}

// ── Reset Password view ───────────────────────────────────────────────────────
function ResetPasswordView({ email, token }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

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
      <div className="mb-7">
        <h2 className="text-[1.75rem] font-bold text-gray-900 tracking-tight leading-tight">
          Set new password
        </h2>
        <p className="text-sm text-gray-500 mt-1.5">Choose a strong password for your account.</p>
      </div>
      {done ? (
        <div className="text-center space-y-4 bg-white rounded-2xl ring-1 ring-gray-200/80 p-8">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm text-gray-600">Password reset successfully!</p>
          <a href="/" className="block text-sm font-semibold" style={{ color: BRAND }}>Sign in with new password</a>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="form-label">New Password</label>
            <div className="relative">
              <LockClosedIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type={showPwd ? 'text' : 'password'}
                className="form-input pl-10 pr-10 py-2.5"
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
              <LockClosedIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type={showConfirm ? 'text' : 'password'}
                className="form-input pl-10 pr-10 py-2.5"
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
            className="w-full flex items-center justify-center gap-2 text-white font-semibold py-2.5 px-4 rounded-lg transition-all disabled:opacity-60"
            style={{ background: BRAND }}
          >
            {loading ? 'Resetting…' : 'Reset password'}
          </button>
        </form>
      )}
    </>
  )
}

// ── Trust bar across bottom ───────────────────────────────────────────────────
function TrustBar() {
  const items = [
    { icon: ShieldCheckIcon, title: 'Enterprise-grade security', desc: 'Your data is protected with industry-leading security standards.' },
    { icon: LockClosedIcon, title: 'Trusted by global suppliers', desc: 'Powering supplier relationships around the world.' },
    { icon: GlobeAltIcon, title: '99.9% platform uptime', desc: 'Reliable, scalable, and built for mission-critical operations.' },
    { icon: CheckBadgeIcon, title: 'ISO 27001 Certified', desc: 'Committed to the highest standards of information security.' },
  ]
  return (
    <div style={{ background: BRAND_DARK }}>
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-5 grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-5">
        {items.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.10)' }}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-white text-[13px] font-semibold leading-tight">{title}</p>
              <p className="text-white/60 text-[11px] leading-snug mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Login view ───────────────────────────────────────────────────────────
export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from?.pathname ?? '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [view, setView] = useState('login') // 'login' | 'forgot'

  if (isAuthenticated) return <Navigate to={redirectTo} replace />

  const params = new URLSearchParams(window.location.search)
  const resetEmail = params.get('email')
  const resetToken = params.get('token')
  const isReset = !!(resetEmail && resetToken)

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
    if (isReset) return <ResetPasswordView email={resetEmail} token={resetToken} />
    if (view === 'forgot') return <ForgotPasswordView onBack={() => setView('login')} />
    return (
      <>
        <div className="mb-7">
          <h2 className="text-[1.85rem] font-bold text-gray-900 tracking-tight leading-tight">
            Welcome back
          </h2>
          <p className="text-sm text-gray-500 mt-1.5">
            Sign in to access ANDRITZ Supplier Connect.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="form-label">Work email</label>
            <div className="relative">
              <EnvelopeIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="email"
                className="form-input pl-10 py-2.5"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="form-label">Password</label>
            <div className="relative">
              <LockClosedIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type={showPwd ? 'text' : 'password'}
                className="form-input pl-10 pr-10 py-2.5"
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
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#096fb3] focus:ring-[#096fb3]"
                style={{ accentColor: BRAND }}
              />
              <span className="text-sm text-gray-700">Remember me</span>
            </label>
            <button
              type="button"
              onClick={() => setView('forgot')}
              className="text-sm font-medium hover:underline"
              style={{ color: BRAND }}
            >
              Forgot password?
            </button>
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
            className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3 px-4 rounded-lg transition-all disabled:opacity-60 shadow-sm"
            style={{ background: BRAND }}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Signing in…
              </>
            ) : (
              <>
                Sign in
                <ArrowRightIcon className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Need help? */}
        <div className="mt-7 pt-6 border-t border-gray-200">
          <p className="text-center text-[13px] font-semibold text-gray-700 mb-3">Need help?</p>
          <div className="flex items-center gap-3 rounded-xl bg-gray-50 ring-1 ring-gray-200 px-4 py-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(9,111,179,0.10)' }}>
              <LifebuoyIcon className="h-4 w-4" style={{ color: BRAND }} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-gray-900 leading-tight">Contact support</p>
              <p className="text-[11px] text-gray-500 leading-snug">We're here to help you 24/7</p>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f8fa]">
      <div className="flex-1 flex">
        <LeftPanel />
        <div className="flex-1 flex flex-col">
          {/* Mobile brand bar */}
          <div className="lg:hidden flex items-center gap-3 px-6 py-4" style={{ background: BRAND_DARK }}>
            <AndritzLogo white className="h-5 w-auto" />
            <div className="h-4 w-px bg-white/20 mx-1" />
            <span className="text-white text-xs font-semibold tracking-wide">Supplier Connect</span>
          </div>
          <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
            <div className={`w-full max-w-[420px] transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              {renderRight()}
            </div>
          </div>
        </div>
      </div>
      <TrustBar />
    </div>
  )
}
