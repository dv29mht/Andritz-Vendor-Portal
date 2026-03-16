import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { login }  = useAuth()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [visible,  setVisible]  = useState(false)

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
          background: 'linear-gradient(135deg, #001d3d 0%, #0062AC 45%, #003f7a 80%, #001a3a 100%)',
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
        <div className="absolute top-1/2 right-0 w-48 h-48 rounded-full bg-[#0062AC]/40 translate-x-1/2 -translate-y-1/2" />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="flex flex-col gap-0.5">
              <div className="h-2 w-1 bg-[#e8182c] rounded-sm" />
              <div className="h-5 w-1 bg-white rounded-sm" />
            </div>
            <span className="text-white font-extrabold text-2xl tracking-[0.25em]">ANDRITZ</span>
          </div>
          <p className="text-white/40 text-[10px] tracking-[0.3em] uppercase mt-1.5 ml-6">
            India Private Limited
          </p>
        </div>

        {/* Main copy */}
        <div className="relative z-10">
          <div className="w-8 h-0.5 bg-[#e8182c] mb-8" />
          <h1 className="text-white font-bold leading-[1.1] mb-6" style={{ fontSize: '2.8rem' }}>
            Connecting<br />suppliers<br />worldwide.
          </h1>
          <p className="text-white/50 text-sm leading-relaxed max-w-[280px] mb-10">
            Streamlined vendor onboarding, multi-step approvals, and SAP code assignment — built for Andritz procurement teams.
          </p>

          {/* Stats strip */}
          <div className="flex gap-8">
            {[['Multi-step', 'Approval'], ['Real-time', 'Tracking'], ['SAP', 'Integration']].map(([top, bot]) => (
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
          style={{ background: 'linear-gradient(90deg, #001d3d, #0062AC)' }}>
          <div className="flex flex-col gap-0.5">
            <div className="h-1.5 w-0.5 bg-[#e8182c] rounded-sm" />
            <div className="h-4 w-0.5 bg-white rounded-sm" />
          </div>
          <span className="text-white font-extrabold text-lg tracking-widest">ANDRITZ</span>
          <div className="h-4 w-px bg-white/20 mx-1" />
          <span className="text-white/60 text-sm">Vendor Registration Portal</span>
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
                <div className="h-4 w-0.5 bg-[#0062AC] rounded-full" />
                <span className="text-[11px] font-semibold text-[#0062AC] uppercase tracking-[0.2em]">
                  Vendor Registration Portal
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
                  <input
                    type="password"
                    className="form-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
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
                  style={{ background: 'linear-gradient(135deg, #0062AC, #004f8c)' }}
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
