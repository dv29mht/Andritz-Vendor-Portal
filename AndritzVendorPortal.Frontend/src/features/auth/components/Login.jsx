import { useState, useEffect } from 'react'
import { Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  EyeIcon, EyeSlashIcon,
  EnvelopeIcon, LockClosedIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'
import { authService } from '../services/authService'
import AndritzLogo from '../../../shared/components/AndritzLogo'

const BRAND = '#0869b3'
const BRAND_DARK = '#071f3f'

// ── Feature row in the left hero ─────────────────────────────────────────────
function Feature({ icon, title, desc, tone = 'blue' }) {
  const tones = {
    blue:   { bg: 'rgba(8,105,179,0.09)',  color: '#0869b3' },
    purple: { bg: 'rgba(99,91,255,0.09)',  color: '#635bff' },
    green:  { bg: 'rgba(17,163,106,0.09)', color: '#11a36a' },
    orange: { bg: 'rgba(245,158,11,0.11)', color: '#f59e0b' },
  }
  const t = tones[tone] ?? tones.blue
  return (
    <div className="flex items-start gap-3.5">
      <div
        className="w-[42px] h-[42px] rounded-xl grid place-items-center flex-shrink-0"
        style={{ background: t.bg, color: t.color, boxShadow: `inset 0 0 0 1px ${t.bg}` }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <h3 className="text-[15px] font-bold leading-tight" style={{ color: BRAND_DARK }}>{title}</h3>
        <p className="text-[13px] leading-snug mt-1" style={{ color: '#58708f' }}>{desc}</p>
      </div>
    </div>
  )
}

// ── Center decorative visual (network of cards + animated nodes) ─────────────
function CenterVisual() {
  return (
    <div className="absolute inset-0 pointer-events-none hidden xl:block z-[1]" aria-hidden="true">
      {/* Animated node lines */}
      <div className="absolute" style={{ left: '32%', top: '25%', width: '39%', height: '37%', opacity: 0.88 }}>
        <svg viewBox="0 0 640 430" className="w-full h-full overflow-visible">
          <path className="sc-line" d="M90 235 L250 80 L420 160 L560 70" />
          <path className="sc-line" d="M90 235 L310 255 L500 235" />
          <path className="sc-line" d="M250 80 L300 350 L530 330" />
          <circle className="sc-dot" cx="90"  cy="235" r="5" />
          <circle className="sc-dot" cx="250" cy="80"  r="5" />
          <circle className="sc-dot" cx="420" cy="160" r="5" />
          <circle className="sc-dot" cx="560" cy="70"  r="5" />
          <circle className="sc-dot" cx="310" cy="255" r="5" />
          <circle className="sc-dot" cx="500" cy="235" r="5" />
        </svg>
      </div>

      {/* Pending approvals chip */}
      <div className="sc-floating sc-card-base" style={{ left: '39%', top: '13%', minWidth: 240, padding: '18px 22px' }}>
        <div className="w-[44px] h-[44px] rounded-2xl grid place-items-center" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2"/>
            <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </div>
        <div className="ml-1">
          <strong className="block text-[13px] mb-0.5" style={{ color: BRAND_DARK }}>Pending Approvals</strong>
          <span className="text-[28px] font-extrabold tracking-tight" style={{ color: BRAND_DARK }}>12</span>
        </div>
        <svg className="ml-auto" width="72" height="34" viewBox="0 0 90 38" fill="none">
          <path d="M4 30 L18 23 L33 18 L49 24 L64 22 L84 5" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Approved vendors */}
      <div className="sc-floating sc-card-base" style={{ left: '48%', top: '34%', minWidth: 240, padding: '18px 22px', animationDelay: '0.8s' }}>
        <div className="w-[44px] h-[44px] rounded-2xl grid place-items-center" style={{ background: 'rgba(17,163,106,0.12)', color: '#11a36a' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="ml-1">
          <strong className="block text-[13px] mb-0.5" style={{ color: BRAND_DARK }}>Approved Vendors</strong>
          <div className="flex items-baseline">
            <span className="text-[28px] font-extrabold tracking-tight" style={{ color: BRAND_DARK }}>248</span>
            <span className="ml-2 text-[12px] font-extrabold" style={{ color: '#11a36a' }}>+18 this week</span>
          </div>
        </div>
      </div>

      {/* Round decorative nodes */}
      <div className="sc-floating sc-card-base sc-round" style={{ left: '39%', top: '30%' }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" style={{ color: BRAND }}>
          <path d="M3 21h18" stroke="currentColor" strokeWidth="2"/>
          <path d="M5 21V9l7-5 7 5v12" stroke="currentColor" strokeWidth="2"/>
          <path d="M9 21v-7h6v7" stroke="currentColor" strokeWidth="2"/>
        </svg>
      </div>
      <div className="sc-floating sc-card-base sc-round" style={{ left: '31.5%', top: '46%', animationDelay: '1.1s' }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" style={{ color: BRAND }}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2"/>
          <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2"/>
        </svg>
      </div>

      {/* Onboarding Progress card */}
      <div className="sc-floating sc-card-base" style={{ left: '40.5%', top: '51%', width: 'min(34vw, 540px)', padding: '22px 26px', display: 'block', animationDelay: '0.35s' }}>
        <div className="font-extrabold mb-5 text-[15px]" style={{ color: BRAND_DARK }}>Onboarding Progress</div>
        <div className="relative grid grid-cols-4 gap-1.5">
          <div className="absolute h-[3px] rounded-full" style={{ top: 14, left: '7%', right: '7%', background: `linear-gradient(90deg, ${BRAND} 0 68%, rgba(8,105,179,0.17) 68% 100%)` }} />
          {[
            { label: 'Invited',   icon: '✓', active: true,  pending: false },
            { label: 'Documents', icon: '✓', active: true,  pending: false },
            { label: 'Review',    icon: '3', active: true,  pending: false },
            { label: 'Approved',  icon: '4', active: false, pending: true  },
          ].map((s) => (
            <div key={s.label} className="relative text-center z-10 text-[12.5px] font-bold" style={{ color: BRAND_DARK }}>
              <div
                className="w-8 h-8 rounded-full mx-auto mb-3 grid place-items-center text-[12px] font-bold"
                style={
                  s.pending
                    ? { background: 'rgba(255,255,255,0.76)', color: BRAND, border: `2px dashed rgba(8,105,179,0.55)` }
                    : { background: BRAND, color: '#fff', boxShadow: '0 0 0 8px rgba(8,105,179,0.08)' }
                }
              >
                {s.icon}
              </div>
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity card */}
      <div className="sc-floating sc-card-base" style={{ left: '40.5%', bottom: '9%', width: 'min(34vw, 540px)', padding: '20px 26px', display: 'block', animationDelay: '1.2s' }}>
        <div className="flex justify-between items-center mb-4">
          <div className="font-extrabold text-[15px]" style={{ color: BRAND_DARK }}>Recent Activity</div>
          <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full" style={{ color: '#11a36a', background: 'rgba(17,163,106,0.08)' }}>● Live</span>
        </div>
        <div className="grid gap-3.5">
          {[
            { dot: '#11a36a', name: 'Pardeep Sharma', text: 'Final approval granted', time: '2m ago' },
            { dot: '#0869b3', name: 'Devansh Mehta',  text: 'Documents uploaded',     time: '15m ago' },
            { dot: '#635bff', name: 'Yash Singh',     text: 'Review in progress',     time: '42m ago' },
          ].map((a) => (
            <div key={a.name} className="grid items-center gap-2.5 text-[12.5px]" style={{ gridTemplateColumns: '14px 130px 1fr 60px', color: '#58708f' }}>
              <span style={{ color: a.dot }}>●</span>
              <strong style={{ color: BRAND_DARK }}>{a.name}</strong>
              <span>{a.text}</span>
              <span className="text-right">{a.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Forgot Password view ─────────────────────────────────────────────────────
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
      <h2 className="text-[28px] font-extrabold tracking-tight leading-none mb-3" style={{ color: BRAND_DARK }}>Forgot password</h2>
      <p className="mb-8 text-[15px]" style={{ color: '#58708f' }}>Enter your email and we'll send you a reset link.</p>
      {sent ? (
        <div className="text-center space-y-4 bg-white rounded-2xl ring-1 ring-gray-200/80 p-8">
          <div className="w-12 h-12 rounded-full bg-green-100 grid place-items-center mx-auto">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm text-gray-600">If that email is registered, a reset link has been sent. Check your inbox.</p>
          <button onClick={onBack} className="text-sm font-semibold" style={{ color: BRAND }}>Back to sign in</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[14px] font-extrabold mb-2" style={{ color: BRAND_DARK }}>Email address</label>
            <div className="relative">
              <EnvelopeIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: '#6c82a0' }} />
              <input
                type="email"
                className="sc-input"
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
            className="sc-submit"
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
          <button type="button" onClick={onBack} className="w-full text-sm hover:underline" style={{ color: '#58708f' }}>
            Back to sign in
          </button>
        </form>
      )}
    </>
  )
}

// ── Reset Password view ──────────────────────────────────────────────────────
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
      <h2 className="text-[28px] font-extrabold tracking-tight leading-none mb-3" style={{ color: BRAND_DARK }}>Set new password</h2>
      <p className="mb-8 text-[15px]" style={{ color: '#58708f' }}>Choose a strong password for your account.</p>
      {done ? (
        <div className="text-center space-y-4 bg-white rounded-2xl ring-1 ring-gray-200/80 p-8">
          <div className="w-12 h-12 rounded-full bg-green-100 grid place-items-center mx-auto">
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
            <label className="block text-[14px] font-extrabold mb-2" style={{ color: BRAND_DARK }}>New Password</label>
            <div className="relative">
              <LockClosedIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: '#6c82a0' }} />
              <input
                type={showPwd ? 'text' : 'password'}
                className="sc-input"
                placeholder="Min 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoFocus
              />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 grid place-items-center" style={{ color: '#6c82a0' }} tabIndex={-1}>
                {showPwd ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[14px] font-extrabold mb-2" style={{ color: BRAND_DARK }}>Confirm Password</label>
            <div className="relative">
              <LockClosedIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: '#6c82a0' }} />
              <input
                type={showConfirm ? 'text' : 'password'}
                className="sc-input"
                placeholder="Repeat password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 grid place-items-center" style={{ color: '#6c82a0' }} tabIndex={-1}>
                {showConfirm ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="sc-submit">
            {loading ? 'Resetting…' : 'Reset password'}
          </button>
        </form>
      )}
    </>
  )
}

// ── Main Login view ──────────────────────────────────────────────────────────
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
  const [view, setView] = useState('login') // 'login' | 'forgot'

  useEffect(() => {
    document.body.classList.add('sc-login-body')
    return () => document.body.classList.remove('sc-login-body')
  }, [])

  if (isAuthenticated) return <Navigate to={redirectTo} replace />

  const params = new URLSearchParams(window.location.search)
  const resetEmail = params.get('email')
  const resetToken = params.get('token')
  const isReset = !!(resetEmail && resetToken)

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
        <h2 className="text-[34px] font-extrabold tracking-tight leading-none mb-3" style={{ color: BRAND_DARK }}>Welcome back</h2>
        <p className="mb-8 text-[15px]" style={{ color: '#58708f' }}>Sign in to access ANDRITZ Supplier Connect</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[14px] font-extrabold mb-2" style={{ color: BRAND_DARK }}>Work email</label>
            <div className="relative">
              <EnvelopeIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: '#6c82a0' }} />
              <input
                type="email"
                className="sc-input"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                required
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-[14px] font-extrabold mb-2" style={{ color: BRAND_DARK }}>Password</label>
            <div className="relative">
              <LockClosedIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: '#6c82a0' }} />
              <input
                type={showPwd ? 'text' : 'password'}
                className="sc-input"
                placeholder="••••••••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 grid place-items-center" style={{ color: '#6c82a0' }} tabIndex={-1}>
                {showPwd ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 text-[14px]">
            <label className="inline-flex items-center gap-2.5 cursor-pointer select-none" style={{ color: '#415878' }}>
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                className="h-[18px] w-[18px]"
                style={{ accentColor: BRAND }}
              />
              Remember me
            </label>
            <button
              type="button"
              onClick={() => setView('forgot')}
              className="font-bold hover:underline"
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

          <button type="submit" disabled={loading} className="sc-submit">
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Signing in…
              </>
            ) : (
              <>
                Sign in
                <ArrowRightIcon className="h-5 w-5" />
              </>
            )}
          </button>
        </form>
      </>
    )
  }

  return (
    <>
      <style>{styles}</style>
      <main className="sc-page">
        {/* LEFT — marketing */}
        <section className="sc-left" aria-label="Product overview">
          <div className="sc-brand">
            <AndritzLogo className="sc-andritz-logo" />
            <div className="sc-brand-title">Supplier Connect</div>
          </div>

          <div className="sc-hero">
            <h1 className="sc-headline">
              Connected supplier<br />
              onboarding, built for<br />
              <span>speed and control.</span>
            </h1>
            <p className="sc-subtext">
              Streamline supplier onboarding, approvals, and collaboration in one secure,
              enterprise-grade workspace.
            </p>

            <div className="sc-features">
              <Feature
                tone="blue"
                title="Secure onboarding"
                desc="Verify, onboard, and manage suppliers with built-in data security and compliance."
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" stroke="currentColor" strokeWidth="2"/>
                    <path d="m9 12 2 2 4-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                }
              />
              <Feature
                tone="purple"
                title="Approval workflows"
                desc="Automate multi-level approvals with full visibility and audit trails."
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                    <path d="m8.5 12 2.3 2.3L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                }
              />
              <Feature
                tone="green"
                title="Supplier collaboration"
                desc="Share documents, track requests, and communicate in real time."
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2"/>
                    <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                }
              />
              <Feature
                tone="orange"
                title="Enterprise visibility"
                desc="Live dashboards and insights to drive better decisions across your supply chain."
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M3 21h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M7 17V9"  stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M12 17V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M17 17v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                }
              />
            </div>
          </div>
        </section>

        <CenterVisual />

        {/* RIGHT — login card */}
        <section className="sc-right" aria-label="Login form">
          <div className="sc-login-card">
            {renderRight()}
          </div>
        </section>
      </main>
    </>
  )
}

// ── Scoped styles for the login page ─────────────────────────────────────────
const styles = `
.sc-login-body { overflow: hidden; }

.sc-page {
  position: relative;
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  isolation: isolate;
  background:
    linear-gradient(90deg, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.9) 30%, rgba(229,242,253,0.74) 58%, rgba(220,238,253,0.62) 100%),
    url("https://images.unsplash.com/photo-1581093458791-9d42cc4f03f3?auto=format&fit=crop&w=2400&q=85") center / cover no-repeat;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #0b2447;
}

.sc-page::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 52% 38%, rgba(0,132,255,0.18), transparent 24%),
    radial-gradient(circle at 75% 10%, rgba(0,105,179,0.18), transparent 28%),
    linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.72));
  z-index: -2;
  pointer-events: none;
}

.sc-page::after {
  content: "";
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(8,105,179,0.055) 1px, transparent 1px),
    linear-gradient(90deg, rgba(8,105,179,0.055) 1px, transparent 1px);
  background-size: 44px 44px;
  -webkit-mask-image: linear-gradient(to bottom, transparent, black 20%, black 72%, transparent);
          mask-image: linear-gradient(to bottom, transparent, black 20%, black 72%, transparent);
  z-index: -1;
  pointer-events: none;
  animation: scGridMove 18s linear infinite;
}

@keyframes scGridMove {
  from { background-position: 0 0; }
  to   { background-position: 44px 44px; }
}

.sc-left {
  padding: clamp(36px, 4vw, 64px) clamp(36px, 4vw, 64px) clamp(36px, 4vw, 56px);
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  position: relative;
  z-index: 2;
  min-height: 100vh;
}

.sc-brand {
  margin-bottom: clamp(24px, 2.6vw, 40px);
}

.sc-andritz-logo {
  width: clamp(118px, 9.5vw, 150px);
  display: block;
  margin-bottom: 6px;
}

.sc-brand-title {
  font-size: clamp(14px, 1.3vw, 20px);
  font-weight: 800;
  letter-spacing: -0.025em;
  color: #071f3f;
}

.sc-hero {
  max-width: 540px;
  animation: scFadeUp 0.8s ease both;
}

.sc-headline {
  font-size: clamp(28px, 2.6vw, 40px);
  line-height: 1.08;
  letter-spacing: -0.035em;
  font-weight: 800;
  color: #071f3f;
}

.sc-headline span { color: #0869b3; }

.sc-subtext {
  margin-top: 16px;
  max-width: 480px;
  font-size: clamp(13.5px, 0.95vw, 15.5px);
  line-height: 1.6;
  color: #58708f;
}

.sc-features {
  margin-top: clamp(22px, 2.2vw, 32px);
  display: grid;
  gap: clamp(14px, 1.4vw, 20px);
  max-width: 520px;
}

.sc-features > * { animation: scFadeUp 0.8s ease both; }
.sc-features > *:nth-child(2) { animation-delay: 0.08s; }
.sc-features > *:nth-child(3) { animation-delay: 0.16s; }
.sc-features > *:nth-child(4) { animation-delay: 0.24s; }

@keyframes scFadeUp {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Center visual */
.sc-line {
  stroke: rgba(10,125,216,0.28);
  stroke-width: 2;
  fill: none;
  stroke-dasharray: 7 9;
  animation: scDash 9s linear infinite;
}
@keyframes scDash { to { stroke-dashoffset: -160; } }

.sc-dot {
  fill: #fff;
  filter: drop-shadow(0 0 10px rgba(6,126,216,0.95));
  animation: scPulse 2.8s ease-in-out infinite;
}
@keyframes scPulse {
  0%, 100% { transform: scale(1);   opacity: 0.75; }
  50%      { transform: scale(1.6); opacity: 1; }
}

.sc-card-base {
  position: absolute;
  background: rgba(255,255,255,0.82);
  -webkit-backdrop-filter: blur(18px);
          backdrop-filter: blur(18px);
  border: 1px solid rgba(255,255,255,0.76);
  box-shadow: 0 24px 70px rgba(24,64,112,0.18);
  border-radius: 18px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.sc-floating { animation: scFloat 5.5s ease-in-out infinite; }

@keyframes scFloat {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-12px); }
}

.sc-round {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: grid;
  place-items: center;
}

/* Right side / login card */
.sc-right {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(30px, 5vw, 72px);
  z-index: 3;
  position: relative;
}

.sc-login-card {
  width: min(100%, 440px);
  background: rgba(255,255,255,0.92);
  -webkit-backdrop-filter: blur(24px);
          backdrop-filter: blur(24px);
  border: 1px solid rgba(255,255,255,0.9);
  border-radius: 28px;
  padding: clamp(32px, 4vw, 48px);
  box-shadow: 0 28px 90px rgba(14,55,99,0.18);
  animation: scCardIn 0.85s cubic-bezier(.2,.9,.2,1) both;
}

@keyframes scCardIn {
  from { opacity: 0; transform: translateY(28px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0)    scale(1); }
}

.sc-input {
  width: 100%;
  height: 54px;
  border: 1px solid #ccd9e8;
  border-radius: 8px;
  background: rgba(255,255,255,0.76);
  padding: 0 48px;
  color: #071f3f;
  font-size: 15px;
  outline: none;
  transition: 0.22s ease;
}
.sc-input:focus {
  border-color: #0869b3;
  box-shadow: 0 0 0 4px rgba(8,105,179,0.10);
  background: #fff;
}
.sc-input::placeholder { color: #9aaec5; }

.sc-submit {
  width: 100%;
  height: 58px;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
  color: #fff;
  font-size: 17px;
  font-weight: 800;
  background: linear-gradient(135deg, #075ea2, #0874c9);
  box-shadow: 0 14px 28px rgba(8,105,179,0.22);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  transition: 0.22s ease;
  position: relative;
  overflow: hidden;
}
.sc-submit::before {
  content: "";
  position: absolute;
  top: 0; left: -80%;
  width: 55%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent);
  transform: skewX(-18deg);
  transition: 0.65s ease;
}
.sc-submit:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 18px 34px rgba(8,105,179,0.30);
}
.sc-submit:hover:not(:disabled)::before { left: 125%; }
.sc-submit:disabled { opacity: 0.7; cursor: not-allowed; }

/* Responsive */
@media (max-width: 1180px) {
  .sc-login-body { overflow: auto; }
  .sc-page { min-height: auto; grid-template-columns: 1fr; }
  .sc-left { min-height: 720px; padding-bottom: 80px; }
  .sc-right { padding-top: 0; padding-bottom: 60px; }
}

@media (max-width: 760px) {
  .sc-left {
    padding: 32px 22px 60px;
    min-height: auto;
  }
  .sc-brand { position: static; margin-bottom: 40px; }
  .sc-hero { margin-top: 0; }
  .sc-features { gap: 16px; }
  .sc-right { padding: 22px; }
  .sc-login-card { border-radius: 22px; }
}
`
