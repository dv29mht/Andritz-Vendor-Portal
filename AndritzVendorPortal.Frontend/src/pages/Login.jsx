import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'

export default function Login() {
  const { login }  = useAuth()
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [showPwd,     setShowPwd]     = useState(false)
  const [error,       setError]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [visible,     setVisible]     = useState(false)

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
    } catch (err) {
      setError(err.response?.data?.message ?? 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel ── */}
      <div
        className="hidden lg:flex lg:w-[48%] xl:w-1/2 flex-col justify-between p-14 relative overflow-hidden login-bg-animate"
        style={{
          background: 'linear-gradient(145deg, #064e80 0%, #096fb3 45%, #075d99 75%, #053e66 100%)',
        }}
      >
        {/* SVG geometric background */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.8"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 w-[380px] h-[380px] rounded-full border border-white/10" />
        <div className="absolute -top-12 -right-12 w-[260px] h-[260px] rounded-full border border-white/10" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full bg-white/5 -translate-x-1/2 translate-y-1/2" />
        <div className="absolute top-1/2 right-0 w-48 h-48 rounded-full bg-[#096fb3]/30 translate-x-1/2 -translate-y-1/2" />

        {/* Logo */}
        <div className="relative z-10">
          <p className="text-white leading-none"
            style={{ fontFamily: "'Barlow Condensed', 'Arial Black', Arial, sans-serif", fontWeight: 900, fontSize: '1.9rem', letterSpacing: '0.16em' }}>
            ANDRITZ
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-white/50 text-[9px] font-bold tracking-[0.5em] uppercase">KYC</span>
            <span className="text-white/20 text-[8px]">·</span>
            <span className="text-white/35 text-[8.5px] tracking-wider">Vendor Onboarding &amp; Compliance</span>
          </div>
        </div>

        {/* Main copy */}
        <div className="relative z-10">
          <div className="w-8 h-0.5 mb-8" style={{ background: '#096fb3' }} />
          <h1 className="text-white font-bold leading-[1.1] mb-6" style={{ fontSize: '2.8rem' }}>
            Smarter<br />vendor<br />onboarding.
          </h1>
          <p className="text-white/50 text-sm leading-relaxed max-w-[280px] mb-10">
            Multi-step approvals, real-time tracking, and SAP vendor code assignment — all in one compliance-ready portal.
          </p>

          {/* Stats strip */}
          <div className="flex gap-8">
            {[['Multi-step', 'Approvals'], ['Real-time', 'Tracking'], ['SAP', 'Integration']].map(([top, bot]) => (
              <div key={top}>
                <p className="text-white text-sm font-bold">{top}</p>
                <p className="text-white/40 text-xs">{bot}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-white/25 text-[11px] tracking-wide">
            © {new Date().getFullYear()} Andritz India Private Limited. All rights reserved.
          </p>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col bg-[#f7f8fa] min-h-screen">

        {/* Mobile header */}
        <div className="lg:hidden flex items-center gap-3 px-6 py-4"
          style={{ background: '#064e80' }}>
          <span className="text-white" style={{ fontFamily: "'Barlow Condensed', 'Arial Black', Arial, sans-serif", fontWeight: 900, fontSize: '1.1rem', letterSpacing: '0.14em' }}>ANDRITZ</span>
          <span className="text-[#096fb3] font-extrabold text-lg tracking-widest">KYC</span>
          <div className="h-4 w-px bg-white/20 mx-1" />
          <span className="text-white/60 text-sm">Vendor Onboarding &amp; Compliance</span>
        </div>

        <div className="flex-1 flex items-center justify-center p-6 lg:p-16">
          <div
            className={`w-full max-w-[400px] transition-all duration-700 ease-out ${
              visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            {/* Heading */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-4 w-0.5 rounded-full" style={{ background: '#096fb3' }} />
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: '#096fb3' }}>
                  Andritz KYC Portal
                </span>
              </div>
              <h2 className="text-[1.9rem] font-bold text-gray-900 tracking-tight leading-tight">
                Welcome back
              </h2>
              <p className="text-sm text-gray-400 mt-1.5">
                Sign in with your Andritz credentials to continue.
              </p>
            </div>

            {/* Form */}
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200/80 p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="form-label">Email address</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="you@andritz.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="form-label">Password</label>
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
                      {showPwd
                        ? <EyeSlashIcon className="h-4 w-4" />
                        : <EyeIcon className="h-4 w-4" />}
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

            <p className="text-center text-[11px] text-gray-300 mt-5">
              Access restricted to authorised Andritz personnel only.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
