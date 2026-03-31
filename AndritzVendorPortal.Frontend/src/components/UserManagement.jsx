import { useState, useEffect } from 'react'
import {
  UserPlusIcon, ArrowPathIcon, MagnifyingGlassIcon,
  XMarkIcon, CheckIcon, ExclamationCircleIcon,
  ShieldCheckIcon, ClipboardDocumentIcon,
  PencilSquareIcon, TrashIcon, EyeIcon, EyeSlashIcon,
  EnvelopeIcon, BriefcaseIcon, ComputerDesktopIcon, FingerPrintIcon,
  ChevronLeftIcon, ChevronRightIcon, ArrowUturnLeftIcon,
} from '@heroicons/react/24/outline'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import Toast from './shared/Toast'

const ROLES = ['Buyer', 'Approver']

const ROLE_DISPLAY = {
  Admin: 'Admin', Buyer: 'Buyer', Approver: 'Approver', FinalApprover: 'Final Approver',
}

function formatDesignation(d) {
  if (!d) return null
  return ROLE_DISPLAY[d] ?? d
}

const ROLE_BADGE = {
  Admin:         'bg-purple-50 text-purple-700 ring-purple-200',
  Buyer:         'bg-blue-50   text-blue-700   ring-blue-200',
  Approver:      'bg-indigo-50 text-indigo-700 ring-indigo-200',
  FinalApprover: 'bg-rose-50   text-rose-700   ring-rose-200',
}

const AVATAR_BG = {
  Admin:         'bg-purple-600',
  Buyer:         'bg-blue-600',
  Approver:      'bg-indigo-600',
  FinalApprover: 'bg-rose-600',
}

const HEADER_BG = {
  Admin:         'from-purple-600 to-purple-800',
  Buyer:         'from-blue-600   to-blue-800',
  Approver:      'from-indigo-600 to-indigo-800',
  FinalApprover: 'from-rose-600   to-rose-800',
}

function getInitials(name) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?'
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const ROLE_ACCESS_NOTE = {
  Buyer:
    'Can create new vendor requests, resubmit after rejection, and track their own requests.',
  Approver:
    'Routed to the Approver Console. Can approve or reject requests assigned to them.',
  FinalApprover:
    'Routed to the Final Approver Console. Only the registered email pardeep.sharma@andritz.com can complete a vendor registration and assign the SAP Vendor Code (enforced by server-side policy).',
  Admin:
    'Full visibility of all requests and user management. Cannot create or approve requests.',
}

const CONSOLE_LABEL = {
  Admin:         'Admin Dashboard',
  Buyer:         'Buyer Console',
  Approver:      'Approver Console',
  FinalApprover: 'Final Approver Console',
}

const EMPTY_FORM = { fullName: '', email: '', password: '', role: 'Buyer', designation: '' }

// ── User Detail / Edit Modal ──────────────────────────────────────────────────

function UserDetailModal({ user, onClose, onUpdated, onDeleted }) {
  const [mode, setMode]           = useState('view') // 'view' | 'edit' | 'delete'
  const [form, setForm]           = useState({
    fullName:        user.fullName,
    designation:     user.designation ?? '',
    role:            user.roles[0] ?? 'Buyer',
    newPassword:     '',
    confirmPassword: '',
  })
  const [errors, setErrors]    = useState([])
  const [saving, setSaving]    = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showNewPwd, setShowNewPwd]         = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)

  const primaryRole = user.roles[0]
  const hasEmailGuard = primaryRole === 'FinalApprover'

  const handleSave = async (e) => {
    e.preventDefault()
    setErrors([])
    const errs = []
    if (!form.fullName.trim()) errs.push('Full name is required.')
    if (form.newPassword && form.newPassword.length < 8) errs.push('New password must be at least 8 characters.')
    if (form.newPassword && form.newPassword !== form.confirmPassword) errs.push('Passwords do not match.')
    if (errs.length) { setErrors(errs); return }

    setSaving(true)
    try {
      const { data } = await api.put(`/users/${user.id}`, {
        fullName:    form.fullName.trim(),
        designation: form.designation.trim() || null,
        role:        form.role,
        newPassword: form.newPassword.trim() || null,
      })
      onUpdated(data)
      onClose()
    } catch (err) {
      const detail = err.response?.data
      if (Array.isArray(detail))           setErrors(detail)
      else if (typeof detail === 'string') setErrors([detail])
      else setErrors(['Failed to update user. Please try again.'])
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/users/${user.id}`)
      onDeleted(user.id)
      onClose()
    } catch (err) {
      const detail = err.response?.data
      const msg = typeof detail === 'string' ? detail : 'Failed to delete user. Please try again.'
      setErrors([msg])
      setMode('view')
    } finally {
      setDeleting(false)
    }
  }

  const headerGrad  = HEADER_BG[primaryRole]  ?? 'from-gray-600 to-gray-800'
  const avatarColor = AVATAR_BG[primaryRole]  ?? 'bg-gray-600'
  const initials    = getInitials(user.fullName)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden my-auto max-h-[calc(100vh-2rem)] flex flex-col">

        {/* ── Gradient profile header ── */}
        <div className={`relative bg-gradient-to-br ${headerGrad} px-6 pt-5 pb-8`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className={`flex-shrink-0 w-14 h-14 rounded-2xl ${avatarColor} bg-white/20 flex items-center justify-center shadow-inner`}>
              <span className="text-xl font-bold text-white tracking-wide">{initials}</span>
            </div>
            {/* Name + role + email */}
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-white leading-tight truncate">{user.fullName}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {user.roles.map(role => (
                  <span key={role} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white">
                    {ROLE_DISPLAY[role] ?? role}
                  </span>
                ))}
                {hasEmailGuard && (
                  <span className="flex items-center gap-0.5 text-xs text-white/70 font-medium">
                    <ShieldCheckIcon className="h-3 w-3" />
                    email-gated
                  </span>
                )}
              </div>
              <p className="text-xs text-white/60 mt-1 truncate">{user.email}</p>
            </div>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">

        {/* ── Errors ── */}
        {errors.length > 0 && (
          <div className="mx-5 mt-4 rounded-lg bg-red-50 ring-1 ring-red-200 px-4 py-3">
            <ul className="list-disc list-inside space-y-0.5">
              {errors.map((e, i) => <li key={i} className="text-xs text-red-700">{e}</li>)}
            </ul>
          </div>
        )}

        {/* ── View mode ── */}
        {mode === 'view' && (
          <div className="px-5 py-5 space-y-3">
            {/* Info fields */}
            <div className="grid grid-cols-1 divide-y divide-gray-50 rounded-xl bg-gray-50 ring-1 ring-gray-100 overflow-hidden">
              {[
                { icon: BriefcaseIcon,       label: 'Designation',    value: formatDesignation(user.designation) || '—', mono: false },
                { icon: ComputerDesktopIcon, label: 'Console Access', value: CONSOLE_LABEL[primaryRole] ?? '—',    mono: false },
                { icon: EnvelopeIcon,        label: 'Email',          value: user.email,                           mono: false },
                { icon: FingerPrintIcon,     label: 'User ID',        value: user.id,                              mono: true  },
              ].map(({ icon: Icon, label, value, mono }) => (
                <div key={label} className="flex items-center gap-3 px-4 py-3">
                  <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
                    <p className={`text-sm font-medium text-gray-800 truncate mt-0.5 ${mono ? 'font-mono text-xs text-gray-500' : ''}`}>
                      {value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Access note */}
            <div className="flex items-start gap-2.5 rounded-xl bg-blue-50 ring-1 ring-blue-100 px-3.5 py-3">
              <ShieldCheckIcon className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 leading-relaxed">{ROLE_ACCESS_NOTE[primaryRole]}</p>
            </div>

            {/* Actions */}
            {primaryRole === 'FinalApprover' ? (
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 ring-1 ring-amber-200 px-3.5 py-3">
                <ShieldCheckIcon className="h-4 w-4 text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700">This account is protected and cannot be modified or deleted.</p>
              </div>
            ) : (
              <div className="flex justify-between gap-3 pt-1">
                <button
                  onClick={() => setMode('delete')}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-red-600 rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
                >
                  <TrashIcon className="h-4 w-4" />
                  Delete
                </button>
                <button onClick={() => setMode('edit')} className="btn-primary">
                  <PencilSquareIcon className="h-4 w-4" />
                  Edit User
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Edit mode ── */}
        {mode === 'edit' && (
          <form onSubmit={handleSave} className="px-5 py-5 space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="form-label">Full Name <span className="text-red-500">*</span></label>
                <input
                  className="form-input"
                  value={form.fullName}
                  onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">Designation</label>
                <input
                  className="form-input"
                  placeholder="e.g. Senior Purchase Manager"
                  value={form.designation}
                  onChange={e => setForm(f => ({ ...f, designation: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">Role <span className="text-red-500">*</span></label>
                <select
                  className="form-input"
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                >
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_DISPLAY[r] ?? r}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">
                  New Password
                  <span className="ml-1 text-gray-400 font-normal">(leave blank to keep current)</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPwd ? 'text' : 'password'}
                    className="form-input pr-10"
                    placeholder="Min 8 characters"
                    value={form.newPassword}
                    onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showNewPwd ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="form-label">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPwd ? 'text' : 'password'}
                    className="form-input pr-10"
                    placeholder="Repeat new password"
                    value={form.confirmPassword}
                    onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    disabled={!form.newPassword}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                    disabled={!form.newPassword}
                  >
                    {showConfirmPwd ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-blue-50 ring-1 ring-blue-100 px-3.5 py-3">
              <ShieldCheckIcon className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 leading-relaxed">{ROLE_ACCESS_NOTE[form.role]}</p>
            </div>

            <div className="flex justify-between gap-3 pt-1">
              <button type="button" className="btn-secondary" onClick={() => { setMode('view'); setErrors([]) }}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}

        {/* ── Delete confirmation ── */}
        {mode === 'delete' && (
          <div className="px-5 py-5 space-y-4">
            {/* Mini profile recap */}
            <div className="flex items-center gap-3 rounded-xl bg-gray-50 ring-1 ring-gray-100 px-4 py-3">
              <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${avatarColor} flex items-center justify-center`}>
                <span className="text-sm font-bold text-white">{initials}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{user.fullName}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
            </div>
            <div className="rounded-xl bg-red-50 ring-1 ring-red-200 px-4 py-3">
              <p className="text-sm font-semibold text-red-800 mb-1">Permanently delete this account?</p>
              <p className="text-xs text-red-700">
                This action cannot be undone. All login access for this user will be revoked immediately.
              </p>
            </div>
            <div className="flex justify-between gap-3">
              <button className="btn-secondary" onClick={() => { setMode('view'); setErrors([]) }}>
                Cancel
              </button>
              <button
                className="btn-danger"
                disabled={deleting}
                onClick={handleDelete}
              >
                <TrashIcon className="h-4 w-4" />
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        )}
        </div>{/* end scrollable body */}
      </div>
    </div>
  )
}

// ── Main UserManagement component ─────────────────────────────────────────────

export default function UserManagement() {
  const { currentUser, updateUser } = useAuth()
  const [users, setUsers]               = useState([])
  const [archivedUsers, setArchivedUsers] = useState([])
  const [showArchived, setShowArchived] = useState(false)
  const [loading, setLoading]           = useState(true)
  const [fetchError, setFetchError]     = useState(null)
  const [search, setSearch]             = useState('')
  const [roleFilter, setRoleFilter]     = useState('All')
  const [showForm, setShowForm]         = useState(false)
  const [form, setForm]                 = useState(EMPTY_FORM)
  const [formErrors, setFormErrors]     = useState([])
  const [saving, setSaving]             = useState(false)
  const [syncing, setSyncing]           = useState(false)
  const [syncMsg, setSyncMsg]           = useState(null)
  const [toast, setToast]               = useState(null)
  const [copiedPwd, setCopiedPwd]       = useState(false)
  const [detailUser, setDetailUser]     = useState(null)
  const [page,       setPage]           = useState(1)

  const fetchUsers = async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const [{ data: active }, { data: archived }] = await Promise.all([
        api.get('/users'),
        api.get('/users/archived'),
      ])
      setUsers(active)
      setArchivedUsers(archived)
    } catch {
      setFetchError('Could not load users. The server may be starting up — please retry in a moment.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const visible = users.filter(u => {
    if (u.roles.includes('Admin')) return false
    const q = search.toLowerCase()
    const matchSearch = !q
      || u.fullName.toLowerCase().includes(q)
      || u.email.toLowerCase().includes(q)
      || (u.designation ?? '').toLowerCase().includes(q)
      || u.roles.some(r => r.toLowerCase().includes(q))
    const matchRole = roleFilter === 'All' || u.roles.includes(roleFilter)
    return matchSearch && matchRole
  })

  const handleFormChange = (field, value) => {
    setForm(f => ({ ...f, [field]: value }))
    setFormErrors([])
    setToast(null)
  }

  const handleAddUser = async (e) => {
    e.preventDefault()
    setFormErrors([])

    const errs = []
    if (!form.fullName.trim()) errs.push('Full name is required.')
    if (!form.email.trim())    errs.push('Email address is required.')
    if (form.email.trim() && !form.email.toLowerCase().endsWith('@andritz.com'))
      errs.push('Email must use the @andritz.com domain.')

    if (!form.password.trim()) errs.push('Password is required.')
    else if (form.password.trim().length < 8) errs.push('Password must be at least 8 characters.')
    if (errs.length) { setFormErrors(errs); return }

    setSaving(true)
    try {
      const { data } = await api.post('/users', {
        fullName:    form.fullName,
        email:       form.email,
        password:    form.password.trim(),
        role:        form.role,
        designation: form.designation.trim() || null,
      })
      setUsers(prev => [...prev, data].sort((a, b) => a.fullName.localeCompare(b.fullName)))
      setForm(EMPTY_FORM)
      setShowForm(false)
      setCopiedPwd(false)
      setToast({ type: 'success', title: 'User added', body: `${data.fullName} has been added as ${ROLE_DISPLAY[data.roles[0]] ?? data.roles[0]}.` })
    } catch (err) {
      const detail = err.response?.data
      if (Array.isArray(detail))           setFormErrors(detail)
      else if (typeof detail === 'string') setFormErrors([detail])
      else setFormErrors(['Failed to create user. Please try again.'])
    } finally {
      setSaving(false)
    }
  }

  const copyPassword = (pwd) => {
    navigator.clipboard.writeText(pwd)
    setCopiedPwd(true)
    setTimeout(() => setCopiedPwd(false), 2000)
  }

  const handleSyncAd = async () => {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const { data } = await api.post('/users/sync-ad')
      setSyncMsg({ type: 'info', text: data.message })
    } catch {
      setSyncMsg({ type: 'error', text: 'Sync request failed. Please try again.' })
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(null), 6000)
    }
  }

  const handleUserUpdated = (updated) => {
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u).sort((a, b) => a.fullName.localeCompare(b.fullName)))
    // If the admin edited their own account, sync the auth context so the header updates
    if (currentUser && updated.id === currentUser.id) {
      updateUser({ name: updated.fullName, fullName: updated.fullName })
    }
  }

  const handleUserDeleted = (id) => {
    const deleted = users.find(u => u.id === id)
    setUsers(prev => prev.filter(u => u.id !== id))
    if (deleted) {
      setArchivedUsers(prev => [...prev, deleted].sort((a, b) => a.fullName.localeCompare(b.fullName)))
      setToast({ type: 'success', title: 'User archived', body: `${deleted.fullName} has been successfully archived.` })
    }
  }

  const handleRestore = async (u) => {
    try {
      const { data: restored } = await api.put(`/users/${u.id}/restore`)
      setArchivedUsers(prev => prev.filter(a => a.id !== u.id))
      setUsers(prev => [...prev, restored].sort((a, b) => a.fullName.localeCompare(b.fullName)))
      setToast({ type: 'success', title: 'User restored', body: `${restored.fullName} has been successfully restored.` })
    } catch (err) {
      setToast({ type: 'error', title: 'Restore failed', body: err?.response?.data || 'Failed to restore user.' })
    }
  }

  return (
    <div>
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} registered account{users.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleSyncAd} disabled={syncing} className="btn-secondary">
            <ArrowPathIcon className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync from AD'}
          </button>
          <button
            onClick={() => { setShowForm(true); setFormErrors([]) }}
            className="btn-primary"
          >
            <UserPlusIcon className="h-4 w-4" />
            Add User
          </button>
        </div>
      </div>

      {/* AD sync message */}
      {syncMsg && (
        <div className={`mb-4 flex items-start gap-2 rounded-lg px-4 py-3 text-sm ring-1 ring-inset ${
          syncMsg.type === 'error'
            ? 'bg-red-50 text-red-700 ring-red-200'
            : 'bg-blue-50 text-blue-700 ring-blue-200'
        }`}>
          <ExclamationCircleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
          {syncMsg.text}
        </div>
      )}


      {/* Add User inline form */}
      {showForm && (
        <div className="card mb-5 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#096fb3] transition-colors font-medium"
              >
                <ChevronLeftIcon className="h-3.5 w-3.5" />
                User Management
              </button>
              <span className="text-gray-200 text-sm">/</span>
              <h3 className="font-semibold text-gray-900 text-sm">New User</h3>
            </div>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {formErrors.length > 0 && (
            <div className="mb-4 rounded-lg bg-red-50 ring-1 ring-red-200 px-4 py-3">
              <ul className="list-disc list-inside space-y-0.5">
                {formErrors.map((e, i) => <li key={i} className="text-xs text-red-700">{e}</li>)}
              </ul>
            </div>
          )}

          <form onSubmit={handleAddUser} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Full Name <span className="text-red-500">*</span></label>
              <input className="form-input" placeholder="e.g. Priya Mehta"
                value={form.fullName} onChange={e => handleFormChange('fullName', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Email <span className="text-red-500">*</span>
                <span className="ml-1 text-gray-400 font-normal">(@andritz.com only)</span>
              </label>
              <input type="email" className="form-input" placeholder="priya.mehta@andritz.com"
                value={form.email} onChange={e => handleFormChange('email', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Designation</label>
              <input className="form-input" placeholder="e.g. Senior Purchase Manager"
                value={form.designation} onChange={e => handleFormChange('designation', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Role <span className="text-red-500">*</span></label>
              <select className="form-input" value={form.role} onChange={e => handleFormChange('role', e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_DISPLAY[r] ?? r}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Password <span className="text-red-500">*</span></label>
              <input type="password" className="form-input" placeholder="Enter a strong password"
                value={form.password} onChange={e => handleFormChange('password', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-start gap-2 rounded-lg bg-blue-50 ring-1 ring-blue-100 px-3 py-2.5">
                <ShieldCheckIcon className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">{ROLE_ACCESS_NOTE[form.role]}</p>
              </div>
            </div>
            <div className="sm:col-span-2 flex justify-end gap-3 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search + table — hidden while Add User form is open */}
      {!showForm && (<>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="relative max-w-xs flex-shrink-0">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input className="form-input pl-9" placeholder="Search by name, email, role…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['All', 'Buyer', 'Approver', 'FinalApprover'].map(r => (
            <button
              key={r}
              onClick={() => { setRoleFilter(r); setPage(1) }}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                roleFilter === r
                  ? 'bg-slate-700 text-white ring-slate-700'
                  : 'bg-white text-gray-600 ring-gray-200 hover:bg-gray-50'
              }`}
            >
              {r === 'FinalApprover' ? 'Final Approver' : r}
            </button>
          ))}
        </div>
      </div>

      {/* Users table */}
      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['Full Name', 'Designation', 'Email', 'Role(s)', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {loading && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">Loading users…</td></tr>
            )}
            {!loading && fetchError && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center">
                  <p className="text-sm text-red-600 mb-3">{fetchError}</p>
                  <button onClick={fetchUsers} className="btn-primary !text-xs !py-1.5 !px-4">
                    <ArrowPathIcon className="h-3.5 w-3.5" />
                    Retry
                  </button>
                </td>
              </tr>
            )}
            {!loading && !fetchError && visible.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">No users match the search.</td></tr>
            )}
            {!loading && !fetchError && (() => {
              const PAGE_SIZE = 10
              return visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
            })().map(user => {
              const primaryRole = user.roles[0]
              const consoleLabel = CONSOLE_LABEL[primaryRole] ?? '—'
              const hasEmailGuard = primaryRole === 'FinalApprover'
              return (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      className="font-medium text-[#0062AC] hover:underline whitespace-nowrap text-left"
                      onClick={() => setDetailUser(user)}
                    >
                      {user.fullName}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {formatDesignation(user.designation) || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{user.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map(role => (
                        <span key={role} className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ring-1 ring-inset ${ROLE_BADGE[role] ?? 'bg-gray-100 text-gray-600 ring-gray-200'}`}>
                          {ROLE_DISPLAY[role] ?? role}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      className="btn-secondary !py-1 !px-2 !text-xs"
                      onClick={() => setDetailUser(user)}
                    >
                      <EyeIcon className="h-3.5 w-3.5" />
                      View
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-50 text-xs text-gray-400 flex items-center justify-between flex-wrap gap-2">
          <span className="flex items-center gap-3">
            {(() => {
              const PAGE_SIZE  = 10
              const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
              const start      = visible.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
              const end        = Math.min(page * PAGE_SIZE, visible.length)
              return (<>
                <span>Showing {visible.length === 0 ? '0' : `${start}–${end}`} of {visible.length} user{visible.length !== 1 ? 's' : ''}</span>
                {totalPages > 1 && (
                  <span className="flex items-center gap-1">
                    <button className="inline-flex items-center justify-center rounded p-0.5 text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeftIcon className="h-3.5 w-3.5" />
                    </button>
                    <span className="px-1">Page {page} of {totalPages}</span>
                    <button className="inline-flex items-center justify-center rounded p-0.5 text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                      <ChevronRightIcon className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )}
              </>)
            })()}
          </span>
          {archivedUsers.length > 0 && (
            <button
              onClick={() => setShowArchived(v => !v)}
              className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2"
            >
              {showArchived ? 'Hide' : 'View'} archived accounts ({archivedUsers.length})
            </button>
          )}
        </div>
      </div>

      {/* Archived accounts */}
      {showArchived && archivedUsers.length > 0 && (
        <div className="mt-4 rounded-xl ring-1 ring-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Archived Accounts ({archivedUsers.length})</p>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Name</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Email</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Role</th>
              <th className="px-4 py-2.5" />
            </tr></thead>
            <tbody className="divide-y divide-gray-200">
              {archivedUsers.map(u => {
                const role = u.roles[0]
                return (
                  <tr key={u.id} className="opacity-70">
                    <td className="px-4 py-3 font-medium text-gray-700 line-through">{u.fullName}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${ROLE_BADGE[role] ?? 'bg-gray-50 text-gray-600 ring-gray-200'}`}>
                        {ROLE_DISPLAY[role] ?? role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRestore(u)}
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 ring-1 ring-green-200 hover:bg-green-100 transition-colors"
                        title="Restore this account"
                      >
                        <ArrowUturnLeftIcon className="w-3.5 h-3.5" />
                        Restore
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      </>)}

      {/* User Detail Modal */}
      {detailUser && (
        <UserDetailModal
          user={detailUser}
          onClose={() => setDetailUser(null)}
          onUpdated={handleUserUpdated}
          onDeleted={handleUserDeleted}
        />
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
