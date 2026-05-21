import { useEffect, useMemo, useRef, useState } from 'react'
import {
  XMarkIcon, ArrowPathIcon, EyeIcon, PencilSquareIcon, CheckCircleIcon,
  ExclamationCircleIcon, ClipboardDocumentIcon,
} from '@heroicons/react/24/outline'
import { emailTemplatesService } from '../services/emailTemplatesService'

const SAMPLE_VALUES = {
  '[Buyer Name]':                     'Anita Sharma',
  '[Approver Name]':                  'Rohit Verma',
  '[Final Approver Name]':            'Pardeep Sharma',
  '[Intermediate Approver Name(s)]':  'Rohit Verma, Ananya Iyer',
  '[Request ID]':                     '1042',
  '[Vendor Name]':                    'Acme Industries Pvt. Ltd.',
  '[Vendor Code]':                    'V-0001234',
  '[Revision Number]':                '2',
  '[Date & Time]':                    new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }),
  '[Comments]':                       'Please verify the GST certificate and resubmit with the updated PAN scan.',
  '[Email]':                          'anita.sharma@example.com',
  '[Portal URL]':                     'https://vendor-portal.andritz.com',
}

export default function EmailTemplateEditModal({ template, onClose, onSaved }) {
  const [subject,  setSubject]  = useState(template.subject)
  const [bodyText, setBodyText] = useState(template.bodyText)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState(null)
  const [success,  setSuccess]  = useState(false)
  const [tab,      setTab]      = useState('edit')   // 'edit' | 'preview'
  const [preview,  setPreview]  = useState(null)
  const [previewing, setPreviewing] = useState(false)
  const bodyRef = useRef(null)

  const placeholderList = useMemo(
    () => template.placeholders ? template.placeholders.split(',').map(s => s.trim()).filter(Boolean) : [],
    [template.placeholders]
  )

  const isDirty = subject !== template.subject || bodyText !== template.bodyText

  useEffect(() => {
    if (tab !== 'preview') return
    let cancel = false
    setPreviewing(true)
    setPreview(null)
    // Render the *unsaved* current draft via the backend preview endpoint by
    // performing a save-render-rollback dance? Simpler: we do client-side
    // placeholder substitution + reuse the saved-shell preview when possible.
    // For correctness we instead just call preview after save. Here we render
    // a client-side fallback: substitute then show as text in a styled box.
    setTimeout(() => {
      if (cancel) return
      setPreview({
        subject: substitute(subject, SAMPLE_VALUES),
        bodyText: substitute(bodyText, SAMPLE_VALUES),
      })
      setPreviewing(false)
    }, 50)
    return () => { cancel = true }
  }, [tab, subject, bodyText])

  const insertPlaceholder = (token) => {
    const el = bodyRef.current
    if (!el) {
      setBodyText(b => b + token)
      return
    }
    const start = el.selectionStart ?? bodyText.length
    const end   = el.selectionEnd   ?? bodyText.length
    const next  = bodyText.slice(0, start) + token + bodyText.slice(end)
    setBodyText(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + token.length, start + token.length)
    })
  }

  const handleSave = async () => {
    setError(null)
    setSuccess(false)
    if (!subject.trim()) { setError('Subject is required.'); return }
    if (!bodyText.trim()) { setError('Body is required.'); return }
    setSaving(true)
    try {
      const updated = await emailTemplatesService.update(template.code, {
        subject:  subject.trim(),
        bodyText: bodyText.trimEnd(),
      })
      onSaved(updated)
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to save changes.')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!confirm('Reset this template to the original default? Your edits will be lost.')) return
    setSaving(true)
    setError(null)
    try {
      const reset = await emailTemplatesService.reset(template.code)
      setSubject(reset.subject)
      setBodyText(reset.bodyText)
      onSaved(reset)
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to reset template.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">{template.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {template.audience} · Code: <span className="font-mono">{template.code}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-3 border-b border-gray-100 flex gap-2">
          <button
            onClick={() => setTab('edit')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === 'edit'
                ? 'border-[#096fb3] text-[#096fb3]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <PencilSquareIcon className="h-4 w-4" /> Edit
          </button>
          <button
            onClick={() => setTab('preview')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === 'preview'
                ? 'border-[#096fb3] text-[#096fb3]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <EyeIcon className="h-4 w-4" /> Preview
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'edit' && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-5">
              <div className="space-y-4 min-w-0">
                <div>
                  <label className="form-label">Subject</label>
                  <input className="form-input" value={subject} onChange={e => setSubject(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Body</label>
                  <textarea
                    ref={bodyRef}
                    className="form-input font-mono text-[13px] leading-relaxed resize-none"
                    rows={18}
                    value={bodyText}
                    onChange={e => setBodyText(e.target.value)}
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Plain text. Linebreaks render as paragraph breaks; lines starting with • render as a styled bullet list. The Andritz branded header and footer are added automatically when the email is sent.
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Available placeholders</p>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Click to insert at cursor. Values are substituted at send time.
                </p>
                <div className="flex flex-col gap-1.5">
                  {placeholderList.length === 0 && (
                    <p className="text-xs text-gray-400 italic">None defined for this template.</p>
                  )}
                  {placeholderList.map(token => (
                    <button
                      key={token}
                      onClick={() => insertPlaceholder(token)}
                      className="inline-flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-mono text-[#096fb3] bg-blue-50 ring-1 ring-blue-100 hover:bg-blue-100 transition-colors"
                    >
                      <span className="truncate">{token}</span>
                      <ClipboardDocumentIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'preview' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">
                Sample values are substituted below so you can see how the email will look. The
                actual rendered HTML wraps the body in the Andritz branded shell.
              </p>
              {previewing && <p className="text-sm text-gray-500">Rendering…</p>}
              {!previewing && preview && (
                <>
                  <div className="flex items-baseline gap-2 mb-2">
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 flex-shrink-0">Subject</p>
                    <p className="text-sm font-medium text-gray-700 truncate">{preview.subject}</p>
                  </div>
                  <div className="rounded-xl ring-1 ring-gray-200 overflow-hidden bg-white">
                    <div className="px-6 pt-6 pb-4 bg-white flex items-center gap-3">
                      <img
                        src="/andritz-logo.png"
                        alt="Andritz"
                        className="block flex-shrink-0"
                        style={{ height: 24, width: 'auto' }}
                      />
                      <span className="text-gray-500 text-[9px] font-semibold tracking-[0.28em] uppercase leading-none border-l border-gray-300 pl-3">
                        Supplier Connect
                      </span>
                    </div>
                    <div className="px-6 pb-6 bg-white">
                    {preview.bodyText.split(/\n\n+/).map((para, i) => {
                      const lines = para.split('\n').filter(l => l.length > 0)
                      // Split each paragraph into a leading non-bullet
                      // "header" block (e.g. "Request Details:") and a
                      // trailing run of bullet lines. This keeps the table
                      // rendering even when the template has a heading line
                      // above the bullets without a blank line between them.
                      const firstBulletIdx = lines.findIndex(l => l.trim().startsWith('•'))
                      const hasBullets = firstBulletIdx >= 0
                        && lines.slice(firstBulletIdx).every(l => l.trim().startsWith('•'))
                      const headerLines = hasBullets ? lines.slice(0, firstBulletIdx) : lines
                      const bulletLines = hasBullets ? lines.slice(firstBulletIdx) : []

                      const labelValuePairs = bulletLines.length > 0
                        ? bulletLines.map(l => {
                            const stripped = l.replace(/^\s*•\s*/, '')
                            const idx = stripped.indexOf(':')
                            if (idx <= 0 || idx === stripped.length - 1) return null
                            return [stripped.slice(0, idx).trim(), stripped.slice(idx + 1).trim()]
                          })
                        : []
                      const isLabelValueTable = labelValuePairs.length > 0
                        && labelValuePairs.every(p => p !== null)

                      return (
                        <div key={i} className="mb-4 last:mb-0">
                          {headerLines.length > 0 && (
                            <p className="text-sm text-gray-700 leading-relaxed mb-2 last:mb-0">
                              {headerLines.map((l, j) => (
                                <span key={j}>{l}{j < headerLines.length - 1 && <br />}</span>
                              ))}
                            </p>
                          )}
                          {bulletLines.length > 0 && isLabelValueTable && (
                            <table className="w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
                              <tbody>
                                {labelValuePairs.map(([label, value], j) => (
                                  <tr key={j} className={j % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                    <td className="px-3 py-2 text-gray-500 font-medium w-1/3 align-top border-b border-gray-100 last:border-0">{label}</td>
                                    <td className="px-3 py-2 text-gray-900 align-top border-b border-gray-100 last:border-0">{value}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                          {bulletLines.length > 0 && !isLabelValueTable && (
                            <ul className="list-disc pl-5 text-sm text-gray-700">
                              {bulletLines.map((l, j) => (
                                <li key={j} className="my-1">{l.replace(/^\s*•\s*/, '')}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )
                    })}
                  </div>
                    <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-xs text-gray-400">
                      Automated notification from the Andritz Vendor Portal. Do not reply.
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex-1 min-w-0">
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 ring-1 ring-red-200 px-3 py-2">
                <ExclamationCircleIcon className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            {success && !error && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 ring-1 ring-emerald-200 px-3 py-2">
                <CheckCircleIcon className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <p className="text-sm text-emerald-700 font-medium">Template saved.</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
              onClick={handleReset}
              disabled={saving}
              title="Restore the original default Subject and Body"
            >
              <ArrowPathIcon className="h-4 w-4" /> Reset to default
            </button>
            <button className="btn-secondary" onClick={onClose} disabled={saving}>Close</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving || !isDirty}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function substitute(text, values) {
  if (!text) return ''
  let out = text
  for (const [k, v] of Object.entries(values)) {
    out = out.split(k).join(v ?? '—')
  }
  return out
}
