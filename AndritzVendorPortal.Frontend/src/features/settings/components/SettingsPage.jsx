import { useState } from 'react'
import { UserIcon, EnvelopeIcon, KeyIcon, CheckCircleIcon, ExclamationCircleIcon,
         EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { useSettings } from '../hooks/useSettings'

export default function SettingsPage({ currentUser, onUpdate }) {
  const { saving, updateProfile } = useSettings()
  const [name,       setName]       = useState(currentUser.name ?? '')
  const [curPwd,     setCurPwd]     = useState('')
  const [newPwd,     setNewPwd]     = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [error,      setError]      = useState(null)
  const [success,    setSuccess]    = useState(null)
  const [showCur,    setShowCur]    = useState(false)
  const [showNew,    setShowNew]    = useState(false)
  const [showCfm,    setShowCfm]    = useState(false)

  const handleSave = async () => {
    setError(null)
    setSuccess(null)

    if (!name.trim()) { setError('Full name is required.'); return }

    const changingPassword = curPwd || newPwd || confirmPwd
    if (changingPassword) {
      if (!curPwd)              { setError('Enter your current password to change it.'); return }
      if (!newPwd)              { setError('Enter a new password.'); return }
      if (newPwd !== confirmPwd){ setError('New passwords do not match.'); return }
      if (newPwd.length < 8)    { setError('New password must be at least 8 characters.'); return }
      // Mirror the server's ASP.NET Identity password policy so the user gets
      // instant feedback instead of a generic 400 from the API.
      if (!/[A-Z]/.test(newPwd) || !/[a-z]/.test(newPwd) || !/[0-9]/.test(newPwd) || !/[^A-Za-z0-9]/.test(newPwd)) {
        setError('New password must include an uppercase letter, a lowercase letter, a number, and a special character.')
        return
      }
    }

    try {
      const data = await updateProfile({
        fullName:        name.trim(),
        currentPassword: changingPassword ? curPwd : null,
        newPassword:     changingPassword ? newPwd : null,
      })
      onUpdate({ name: data.fullName, fullName: data.fullName })
      setCurPwd('')
      setNewPwd('')
      setConfirmPwd('')
      // The password change keeps the current session valid (the server no longer
      // revokes the live token), so the user simply stays signed in.
      setSuccess(changingPassword ? 'Password updated successfully.' : 'Changes saved successfully.')
    } catch (err) {
      const detail = err.response?.data
      // The API returns { message, errors: [...] }. The errors array carries the
      // specific reason (e.g. "Incorrect password.") — surface it ahead of the
      // generic message so the user knows exactly what to fix.
      if (Array.isArray(detail?.errors) && detail.errors.length) setError(detail.errors.join(' '))
      else if (Array.isArray(detail))           setError(detail.join(' '))
      else if (typeof detail === 'string')      setError(detail)
      else if (detail?.message)                 setError(detail.message)
      else                                      setError('Failed to save changes. Please try again.')
    }
  }

  return (
    <div className="h-full flex flex-col p-6">

      {/* Two-column cards — fills remaining height */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-5 min-h-0">

        {/* Profile */}
        <div className="bg-white rounded-2xl ring-1 ring-gray-200 overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0">
            <h2 className="font-semibold text-gray-900">Profile Information</h2>
            <p className="text-xs text-gray-400 mt-0.5">Your name is displayed across the portal to other users.</p>
          </div>
          <div className="px-6 py-5 space-y-4 flex-1">
            <div>
              <label className="form-label">Full Name</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  className="form-input pl-9"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>
            </div>
            <div>
              <label className="form-label">Email Address</label>
              <div className="relative">
                <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  className="form-input pl-9 bg-gray-50 text-gray-500 cursor-not-allowed"
                  value={currentUser.email ?? ''}
                  disabled
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Email is managed by your Andritz administrator.</p>
            </div>
          </div>
        </div>

        {/* Password */}
        <div className="bg-white rounded-2xl ring-1 ring-gray-200 overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0">
            <h2 className="font-semibold text-gray-900">Change Password</h2>
            <p className="text-xs text-gray-400 mt-0.5">Leave blank if you don't want to change your password.</p>
          </div>
          <div className="px-6 py-5 space-y-4 flex-1">
            {[
              { label: 'Current Password',    value: curPwd,     set: setCurPwd,     ph: 'Current password',           show: showCur, toggle: () => setShowCur(v => !v) },
              { label: 'New Password',         value: newPwd,     set: setNewPwd,     ph: 'New password', show: showNew, toggle: () => setShowNew(v => !v) },
              { label: 'Confirm New Password', value: confirmPwd, set: setConfirmPwd, ph: 'Repeat new password',        show: showCfm, toggle: () => setShowCfm(v => !v) },
            ].map(({ label, value, set, ph, show, toggle }) => (
              <div key={label}>
                <label className="form-label">{label}</label>
                <div className="relative">
                  <KeyIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    type={show ? 'text' : 'password'}
                    className="form-input pl-9 pr-10"
                    value={value}
                    onChange={e => set(e.target.value)}
                    placeholder={ph}
                  />
                  <button
                    type="button"
                    onClick={toggle}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {show ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}
            <p className="text-[11px] text-gray-400">
              Use at least 8 characters with an uppercase letter, a lowercase letter, a number, and a special character.
            </p>
          </div>
        </div>
      </div>

      {/* Feedback + Save — pinned to bottom */}
      <div className="flex-shrink-0 pt-4 flex items-center justify-between gap-4">
        <div className="flex-1">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl bg-red-50 ring-1 ring-red-200 px-4 py-3">
              <ExclamationCircleIcon className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 ring-1 ring-emerald-200 px-4 py-3">
              <CheckCircleIcon className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <p className="text-sm text-emerald-700 font-medium">{success}</p>
            </div>
          )}
        </div>
        <button className="btn-primary flex-shrink-0" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
