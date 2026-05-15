import { useEffect, useMemo, useState } from 'react'
import {
  EnvelopeIcon, PencilSquareIcon, MagnifyingGlassIcon,
  CheckBadgeIcon, ExclamationCircleIcon,
} from '@heroicons/react/24/outline'
import { emailTemplatesService } from '../services/emailTemplatesService'
import EmailTemplateEditModal from './EmailTemplateEditModal'
import Toast from '../../../shared/components/Toast'

const AUDIENCE_COLORS = {
  Buyer:           { bg: 'bg-blue-50',    text: 'text-blue-700',    ring: 'ring-blue-200'    },
  Approver:        { bg: 'bg-amber-50',   text: 'text-amber-700',   ring: 'ring-amber-200'   },
  'Final Approver':{ bg: 'bg-violet-50',  text: 'text-violet-700',  ring: 'ring-violet-200'  },
  Admin:           { bg: 'bg-slate-50',   text: 'text-slate-700',   ring: 'ring-slate-200'   },
}

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [search,    setSearch]    = useState('')
  const [audience,  setAudience]  = useState('All')
  const [editing,   setEditing]   = useState(null)
  const [toast,     setToast]     = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setTemplates(await emailTemplatesService.list())
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to load templates.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const audiences = useMemo(() => {
    const set = new Set(templates.map(t => t.audience).filter(Boolean))
    return ['All', ...Array.from(set)]
  }, [templates])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return templates.filter(t => {
      if (audience !== 'All' && t.audience !== audience) return false
      if (!q) return true
      return t.name.toLowerCase().includes(q)
        || t.subject.toLowerCase().includes(q)
        || t.code.toLowerCase().includes(q)
    })
  }, [templates, search, audience])

  const openEditor = async (code) => {
    try {
      const detail = await emailTemplatesService.get(code)
      setEditing(detail)
    } catch (err) {
      setToast({ type: 'error', title: 'Load failed', body: err.response?.data?.message ?? 'Could not open template.' })
    }
  }

  const handleSaved = (updated) => {
    setTemplates(list => list.map(t => t.code === updated.code
      ? { ...t, subject: updated.subject, updatedAt: updated.updatedAt, isModified: updated.isModified }
      : t))
    setEditing(updated)
    setToast({ type: 'success', title: 'Template saved', body: `“${updated.name}” has been updated.` })
  }

  return (
    <div className="p-6 space-y-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Email Templates</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Customise the subject and body of every notification sent by the portal.
            Placeholders like <span className="font-mono text-[12px]">[Vendor Name]</span> are filled in at send time.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-row items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-0 max-w-xs">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            className="form-input pl-9"
            placeholder="Search by name, subject, or code…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          value={audience}
          onChange={e => setAudience(e.target.value)}
          className="form-input text-sm w-44 shrink-0"
        >
          {audiences.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl bg-red-50 ring-1 ring-red-200 px-4 py-3">
          <ExclamationCircleIcon className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 rounded-full border-2 border-[#096fb3] border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 divide-x divide-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Template</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-32 whitespace-nowrap">Audience</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Subject</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-28 whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {visible.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">
                  {templates.length === 0 ? 'No templates seeded yet.' : 'No templates match the current filter.'}
                </td></tr>
              )}
              {visible.map(t => {
                const colors = AUDIENCE_COLORS[t.audience] ?? AUDIENCE_COLORS.Admin
                return (
                  <tr key={t.code} className="hover:bg-gray-50 transition-colors divide-x divide-gray-200">
                    <td className="px-4 py-3.5 align-top">
                      <div className="flex items-start gap-2.5">
                        <EnvelopeIcon className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-gray-900 leading-snug">{t.name}</p>
                          <p className="text-[11px] font-mono text-gray-400 mt-0.5">{t.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-top whitespace-nowrap">
                      <span className={`inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${colors.bg} ${colors.text} ${colors.ring}`}>
                        {t.audience}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-top text-gray-700">{t.subject}</td>
                    <td className="px-4 py-3.5 align-top">
                      {t.isModified ? (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                          <CheckBadgeIcon className="h-3.5 w-3.5" /> Customised
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Default</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <button
                        className="btn-secondary !py-1 !px-2 !text-xs"
                        onClick={() => openEditor(t.code)}
                      >
                        <PencilSquareIcon className="h-3.5 w-3.5" />
                        Edit
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EmailTemplateEditModal
          template={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
