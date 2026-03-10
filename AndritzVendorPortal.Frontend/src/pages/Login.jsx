import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

const DEMO_ACCOUNTS = [
  { role: 'Buyer',          email: 'vikram.nair@andritz.com',   password: 'Buyer@123!'    },
  { role: 'Approver',       email: 'rajesh.kumar@andritz.com',  password: 'Approver@123!' },
  { role: 'Final Approver', email: 'pardeep.sharma@andritz.com',password: 'Change@Me1!'   },
  { role: 'Admin',          email: 'sunita.rao@andritz.com',    password: 'Admin@123!'    },
]

export default function Login() {
  const { login } = useAuth()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 text-white px-8 py-0 flex items-center gap-4 h-14 shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-1 bg-[#c8102e] rounded-full" />
          <span className="font-extrabold text-lg tracking-widest uppercase">ANDRITZ</span>
        </div>
        <div className="h-5 w-px bg-white/20" />
        <span className="text-sm text-slate-300 font-medium">Vendor Registration Portal</span>
      </header>

      {/* Body */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md space-y-5">

          {/* Login card */}
          <div className="card p-8">
            <h1 className="text-xl font-bold text-gray-900 mb-1">Sign in</h1>
            <p className="text-sm text-gray-500 mb-6">Use your Andritz credentials to access the portal.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                <p className="text-sm text-red-700 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center disabled:opacity-60"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>

          {/* Demo accounts */}
          <div className="card p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Demo accounts — click to fill
            </p>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map(acc => (
                <button
                  key={acc.email}
                  onClick={() => fillAccount(acc)}
                  className="w-full text-left flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-gray-50 ring-1 ring-gray-200 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{acc.role}</p>
                    <p className="text-xs text-gray-400">{acc.email}</p>
                  </div>
                  <span className="text-xs font-mono text-gray-400 ml-2 flex-shrink-0">{acc.password}</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
