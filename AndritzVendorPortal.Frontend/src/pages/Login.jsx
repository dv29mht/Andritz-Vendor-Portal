import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

const DEMO_ACCOUNTS = [
  { role: 'Buyer',          email: 'vikram.nair@andritz.com',    password: 'Dahlia@1234' },
  { role: 'Approver',       email: 'rajesh.kumar@andritz.com',   password: 'Dahlia@1234' },
  { role: 'Final Approver', email: 'pardeep.sharma@andritz.com', password: 'Dahlia@1234' },
  { role: 'Admin',          email: 'sunita.rao@andritz.com',     password: 'Dahlia@1234' },
]

export default function Login() {
  const { login }  = useAuth()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [visible,  setVisible]  = useState(false)

  // Trigger entrance animation on mount
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

  const fillAccount = (acc) => {
    setEmail(acc.email)
    setPassword(acc.password)
    setError('')
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel — Andritz brand ── */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-1/2 bg-[#0062AC] flex-col justify-between p-14 relative overflow-hidden">
        {/* Subtle geometric background shapes */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-white/10" />
          <div className="absolute -bottom-24 -left-24 w-[300px] h-[300px] rounded-full bg-white/10" />
          <div className="absolute top-1/2 right-12 w-[180px] h-[180px] rounded-full bg-white/5" />
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-9 w-1.5 bg-white rounded-full" />
            <span className="text-white font-extrabold text-2xl tracking-widest">ANDRITZ</span>
          </div>
        </div>

        {/* Headline */}
        <div className="relative z-10">
          <p className="text-white/60 text-xs font-semibold uppercase tracking-[0.2em] mb-5">
            Vendor Registration Portal
          </p>
          <h1 className="text-white text-[2.6rem] font-bold leading-[1.15] mb-6">
            Connecting<br />suppliers<br />worldwide.
          </h1>
          <div className="w-12 h-0.5 bg-white/40 mb-6" />
          <p className="text-white/55 text-sm leading-relaxed max-w-[300px]">
            Manage vendor onboarding, multi-step approvals, and SAP code assignment — streamlined for your team.
          </p>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-white/30 text-xs tracking-wide">
            © {new Date().getFullYear()} Andritz India Private Limited. All rights reserved.
          </p>
        </div>
      </div>

      {/* ── Right panel — Sign in ── */}
      <div className="flex-1 flex flex-col bg-gray-50 min-h-screen">

        {/* Mobile header */}
        <div className="lg:hidden bg-[#0062AC] px-6 py-4 flex items-center gap-3 shadow-sm">
          <div className="h-6 w-1 bg-white rounded-full" />
          <span className="text-white font-extrabold text-lg tracking-widest">ANDRITZ</span>
          <div className="h-4 w-px bg-white/20 mx-1" />
          <span className="text-white/70 text-sm font-medium">Vendor Registration Portal</span>
        </div>

        <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
          <div
            className={`w-full max-w-[420px] transition-all duration-700 ease-out ${
              visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            {/* Heading */}
            <div className="mb-8">
              <h2 className="text-[1.75rem] font-bold text-gray-900 tracking-tight">
                Welcome back
              </h2>
              <p className="text-sm text-gray-500 mt-1.5">
                Sign in with your Andritz credentials to continue.
              </p>
            </div>

            {/* Form card */}
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200/80 p-8 mb-4">
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
                  className="w-full flex items-center justify-center gap-2 bg-[#0062AC] hover:bg-[#004f8c] active:bg-[#003d6e] text-white font-semibold py-2.5 px-4 rounded-lg transition-colors duration-150 disabled:opacity-60 mt-2"
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

            {/* Demo accounts */}
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200/80 p-5">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.15em] mb-3">
                Demo accounts — click to fill
              </p>
              <div className="grid grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map(acc => (
                  <button
                    key={acc.email}
                    onClick={() => fillAccount(acc)}
                    className="text-left rounded-xl px-3.5 py-3 ring-1 ring-gray-200 hover:ring-[#0062AC] hover:bg-blue-50/60 transition-all duration-150 group"
                  >
                    <p className="text-xs font-semibold text-gray-800 group-hover:text-[#0062AC]">{acc.role}</p>
                    <p className="text-[10px] text-gray-400 truncate mt-0.5">{acc.email.split('@')[0]}</p>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-300 mt-3 text-center">Password: Dahlia@1234</p>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
