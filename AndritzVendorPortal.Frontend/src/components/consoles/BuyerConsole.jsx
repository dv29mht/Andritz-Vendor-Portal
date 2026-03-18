import { useState, useEffect } from 'react'
import { PlusIcon, PaperAirplaneIcon, PencilSquareIcon, EyeIcon } from '@heroicons/react/24/outline'
import { ExclamationTriangleIcon, CheckBadgeIcon } from '@heroicons/react/24/solid'
import Modal from '../shared/Modal'
import StatusBadge from '../shared/StatusBadge'
import VendorDetailModal from '../VendorDetailModal'
import { CITIES } from '../../data/mockData'
import api from '../../services/api'

const EMPTY_FORM = {
  vendorName: '', materialGroup: '', reason: '',
  contactPerson: '', telephone: '',
  gstNumber: '', panCard: '',
  addressDetails: '', postalCode: '', city: '', locality: '', state: '', country: 'India',
  currency: 'INR', paymentTerms: '', incoterms: '', yearlyPvo: '',
  isOneTimeVendor: false, proposedBy: '',
}

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AED']
const INCOTERMS  = ['EXW','FCA','CPT','CIP','DAP','DPU','DDP','FAS','FOB','CFR','CIF']
const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan',
  'Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu',
  'Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry',
]

function FormSection({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3 border-b border-gray-100 pb-1.5">
        {title}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {children}
      </div>
    </div>
  )
}

function Field({ label, required, error, span = 1, children }) {
  return (
    <div className={span === 2 ? 'sm:col-span-2' : ''}>
      <label className="form-label">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function ApprovalChainBuilder({ approvers, selected, onChange, error }) {
  const available = approvers.filter(a => !selected.find(s => s.id === a.id))

  const add = (id) => {
    const a = approvers.find(x => x.id === id)
    if (a) onChange([...selected, a])
  }
  const remove = (id) => onChange(selected.filter(s => s.id !== id))
  const move = (i, dir) => {
    const arr = [...selected]
    const j = i + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    onChange(arr)
  }

  return (
    <div className="space-y-3">
      {/* Add approver */}
      <select
        className="form-input"
        value=""
        onChange={e => { if (e.target.value) add(e.target.value) }}
      >
        <option value="">+ Add approver to chain…</option>
        {available.map(a => (
          <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
        ))}
      </select>

      {/* Chain preview */}
      {(selected.length > 0 || true) && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Approval Chain Preview</p>
          </div>
          <div className="divide-y divide-gray-100">
            {selected.length === 0 && (
              <div className="px-4 py-3 text-xs text-gray-400 italic">No approvers added yet — select from the dropdown above.</div>
            )}
            {selected.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 bg-white">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{s.name}</p>
                  <p className="text-xs text-gray-400">{s.email}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                    className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/></svg>
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === selected.length - 1}
                    className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                  </button>
                  <button type="button" onClick={() => remove(s.id)}
                    className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            ))}
            {/* Always-last: Pardeep Sharma */}
            <div className="flex items-center gap-3 px-4 py-2.5 bg-rose-50">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center">★</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-rose-800">Pardeep Sharma</p>
                <p className="text-xs text-rose-400">pardeep.sharma@andritz.com · Final Approver</p>
              </div>
              <span className="text-xs text-rose-400 font-medium flex-shrink-0">Auto-added · cannot remove</span>
            </div>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

export default function BuyerConsole({ workflow, currentUser }) {
  const myRequests = workflow.requests.filter(r => r.createdByUserId === currentUser.id)

  const [showForm, setShowForm]                     = useState(false)
  const [editingRequest, setEditingRequest]         = useState(null)
  const [form, setForm]                             = useState(EMPTY_FORM)
  const [selectedApprovers, setSelectedApprovers]   = useState([])
  const [availableApprovers, setAvailableApprovers] = useState([])
  const [viewingRequest, setViewingRequest]         = useState(null)
  const [errors, setErrors]                         = useState({})
  const [submitting, setSubmitting]                 = useState(false)
  const [apiError, setApiError]                     = useState(null)

  useEffect(() => {
    api.get('/users/approvers')
      .then(r => setAvailableApprovers(r.data))
      .catch(() => {})
  }, [])

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const openCreate = () => {
    setEditingRequest(null)
    setForm(EMPTY_FORM)
    setSelectedApprovers([])
    setErrors({})
    setApiError(null)
    setShowForm(true)
  }

  const openEdit = (req) => {
    setEditingRequest(req)
    setForm({
      vendorName:    req.vendorName     ?? '',
      materialGroup: req.materialGroup  ?? '',
      reason:        req.reason         ?? '',
      contactPerson: req.contactPerson  ?? '',
      telephone:     req.telephone      ?? '',
      gstNumber:     req.gstNumber      ?? '',
      panCard:       req.panCard        ?? '',
      addressDetails:req.addressDetails ?? '',
      postalCode:    req.postalCode     ?? '',
      city:          req.city           ?? '',
      locality:      req.locality       ?? '',
      state:         req.state          ?? '',
      country:       req.country        ?? 'India',
      currency:        req.currency        ?? 'INR',
      paymentTerms:    req.paymentTerms    ?? '',
      incoterms:       req.incoterms       ?? '',
      yearlyPvo:       req.yearlyPvo       ?? '',
      isOneTimeVendor: req.isOneTimeVendor ?? false,
      proposedBy:      req.proposedBy      ?? '',
    })
    setErrors({})
    setApiError(null)
    setShowForm(true)
  }

  const validate = () => {
    const e = {}
    if (!form.vendorName.trim())     e.vendorName     = 'Vendor name is required.'
    if (!form.contactPerson.trim())  e.contactPerson  = 'Contact person is required.'
    if (!form.gstNumber.trim())      e.gstNumber      = 'GST Number is required.'
    if (!form.panCard.trim())        e.panCard        = 'PAN Card is required.'
    if (!form.addressDetails.trim()) e.addressDetails = 'Address is required.'
    if (!form.city.trim())           e.city           = 'City is required.'
    if (!form.locality.trim())       e.locality       = 'Locality is required.'
    if (!editingRequest && selectedApprovers.length === 0)
      e.approvers = 'Select at least one approver.'
    return e
  }

  const handleSubmitForm = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSubmitting(true)
    setApiError(null)
    try {
      if (editingRequest) {
        await workflow.resubmit(editingRequest.id, form)
      } else {
        await workflow.createRequest(form, selectedApprovers)
      }
      setShowForm(false)
    } catch (err) {
      const detail = err.response?.data
      if (Array.isArray(detail))          setApiError(detail.join(' '))
      else if (typeof detail === 'string') setApiError(detail)
      else if (detail?.message)            setApiError(detail.message)
      else                                 setApiError('Request failed. Please check your entries and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const revLabel = (n) => n === 0 ? 'Original' : `REV ${n}`

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Vendor Requests</h1>
          <p className="text-sm text-gray-500 mt-0.5">{myRequests.length} request{myRequests.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <PlusIcon className="h-4 w-4" />
          New Request
        </button>
      </div>

      <div className="space-y-4">
        {myRequests.length === 0 && (
          <div className="card p-12 text-center text-gray-400">
            <p className="text-sm">No requests yet. Click "New Request" to get started.</p>
          </div>
        )}

        {myRequests.map(req => (
          <div key={req.id} className="card overflow-hidden">
            {req.status === 'Rejected' && (
              <div className="bg-red-50 border-b border-red-100 px-5 py-3 flex items-start gap-3">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-red-800">Request Rejected</p>
                  <p className="text-sm text-red-700 mt-0.5 truncate">"{req.rejectionComment}"</p>
                </div>
              </div>
            )}
            {req.status === 'Completed' && (
              <div className="bg-emerald-50 border-b border-emerald-100 px-5 py-3 flex items-center gap-3">
                <CheckBadgeIcon className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <p className="text-sm font-semibold text-emerald-800">
                  Vendor Code Assigned: <span className="font-mono tracking-wider">{req.vendorCode}</span>
                </p>
              </div>
            )}

            <div className="px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold text-gray-900">{req.vendorName}</h2>
                  <StatusBadge status={req.status} />
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{revLabel(req.revisionNo)}</span>
                  {req.revisionHistory?.length > 0 && (
                    <span className="text-xs bg-amber-50 text-amber-700 ring-1 ring-amber-200 ring-inset px-2 py-0.5 rounded-full">
                      {req.revisionHistory.length} revision{req.revisionHistory.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {req.contactPerson || req.contactInformation}
                  {req.telephone && <span className="text-gray-400"> · {req.telephone}</span>}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {[req.city, req.locality, req.state].filter(Boolean).join(', ')}
                  {' · '}{new Date(req.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {req.status === 'Rejected' && (
                  <button className="btn-primary" onClick={() => openEdit(req)}>
                    <PencilSquareIcon className="h-4 w-4" />
                    Edit &amp; Resubmit
                  </button>
                )}
                <button className="btn-secondary" onClick={() => setViewingRequest(req)}>
                  <EyeIcon className="h-4 w-4" />
                  View
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {viewingRequest && (
        <VendorDetailModal
          request={workflow.requests.find(r => r.id === viewingRequest.id) ?? viewingRequest}
          onClose={() => setViewingRequest(null)}
        />
      )}

      {showForm && (
        <Modal
          title={editingRequest ? `Edit & Resubmit — ${editingRequest.vendorName}` : 'New Vendor Registration Request'}
          onClose={() => setShowForm(false)}
          size="xl"
        >
          {editingRequest?.rejectionComment && (
            <div className="mb-5 flex items-start gap-3 rounded-lg bg-red-50 ring-1 ring-red-200 p-4">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">Rejection Reason</p>
                <p className="text-sm text-red-700 mt-0.5">"{editingRequest.rejectionComment}"</p>
              </div>
            </div>
          )}

          {apiError && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 ring-1 ring-red-200 px-4 py-3">
              <ExclamationTriangleIcon className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{apiError}</p>
            </div>
          )}

          <div className="space-y-6">

            {/* ── Vendor Information ── */}
            <FormSection title="Vendor Information">
              <Field label="Supplier Name" required error={errors.vendorName} span={2}>
                <input
                  className="form-input"
                  placeholder="e.g. Tata Components Pvt. Ltd."
                  value={form.vendorName}
                  onChange={e => set('vendorName', e.target.value)}
                />
              </Field>
              <Field label="Material Group" error={errors.materialGroup}>
                <input
                  className="form-input"
                  placeholder="e.g. Raw Materials, Packaging"
                  value={form.materialGroup}
                  onChange={e => set('materialGroup', e.target.value)}
                />
              </Field>
              <Field label="Reason for Registration" error={errors.reason}>
                <input
                  className="form-input"
                  placeholder="e.g. New supplier for FY2026"
                  value={form.reason}
                  onChange={e => set('reason', e.target.value)}
                />
              </Field>
              <Field label="Proposed By" error={errors.proposedBy}>
                <textarea
                  className="form-input resize-none"
                  rows={2}
                  placeholder="Name / department proposing this vendor"
                  value={form.proposedBy}
                  onChange={e => set('proposedBy', e.target.value)}
                />
              </Field>
              <Field label="" span={2}>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={form.isOneTimeVendor}
                    onChange={e => set('isOneTimeVendor', e.target.checked)}
                  />
                  <span className="text-sm font-medium text-gray-700">One-Time Vendor</span>
                  <span className="text-xs text-gray-400">(not added to permanent vendor master)</span>
                </label>
              </Field>
            </FormSection>

            {/* ── Address ── */}
            <FormSection title="Address">
              <Field label="Street / Building / Plot" required error={errors.addressDetails} span={2}>
                <textarea
                  className="form-input resize-none"
                  rows={2}
                  placeholder="Plot No., Building Name, Area"
                  value={form.addressDetails}
                  onChange={e => set('addressDetails', e.target.value)}
                />
              </Field>
              <Field label="Postal Code" error={errors.postalCode}>
                <input
                  className="form-input"
                  placeholder="e.g. 400001"
                  maxLength={10}
                  value={form.postalCode}
                  onChange={e => set('postalCode', e.target.value)}
                />
              </Field>
              <Field label="City" required error={errors.city}>
                <input
                  className="form-input"
                  list="city-list"
                  placeholder="e.g. Mumbai"
                  value={form.city}
                  onChange={e => setForm(f => ({ ...f, city: e.target.value, locality: '' }))}
                />
                <datalist id="city-list">
                  {Object.keys(CITIES).map(c => <option key={c} value={c} />)}
                </datalist>
              </Field>
              <Field label="Locality" required error={errors.locality}>
                <input
                  className="form-input"
                  list="locality-list"
                  placeholder="e.g. Andheri"
                  value={form.locality}
                  onChange={e => set('locality', e.target.value)}
                />
                <datalist id="locality-list">
                  {(CITIES[form.city] ?? []).map(l => <option key={l} value={l} />)}
                </datalist>
              </Field>
              <Field label="State" error={errors.state}>
                <select
                  className="form-input"
                  value={form.state}
                  onChange={e => set('state', e.target.value)}
                >
                  <option value="">Select State</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Country" error={errors.country}>
                <input
                  className="form-input"
                  placeholder="India"
                  value={form.country}
                  onChange={e => set('country', e.target.value)}
                />
              </Field>
            </FormSection>

            {/* ── Commercial Terms ── */}
            <FormSection title="Commercial Terms">
              <Field label="Currency" error={errors.currency}>
                <select
                  className="form-input"
                  value={form.currency}
                  onChange={e => set('currency', e.target.value)}
                >
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Payment Terms" error={errors.paymentTerms}>
                <input
                  className="form-input"
                  placeholder="e.g. Net 30, Advance 50%"
                  value={form.paymentTerms}
                  onChange={e => set('paymentTerms', e.target.value)}
                />
              </Field>
              <Field label="Incoterms" error={errors.incoterms}>
                <select
                  className="form-input"
                  value={form.incoterms}
                  onChange={e => set('incoterms', e.target.value)}
                >
                  <option value="">Select Incoterms</option>
                  {INCOTERMS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Yearly PVO" error={errors.yearlyPvo}>
                <input
                  className="form-input"
                  placeholder="e.g. 50,00,000"
                  value={form.yearlyPvo}
                  onChange={e => set('yearlyPvo', e.target.value)}
                />
              </Field>
            </FormSection>

            {/* ── Tax Identification ── */}
            <FormSection title="Tax Identification">
              <Field label="GST Number" required error={errors.gstNumber}>
                <input
                  className="form-input font-mono uppercase tracking-wider"
                  placeholder="e.g. 27AABCT1332L1ZV"
                  value={form.gstNumber}
                  onChange={e => set('gstNumber', e.target.value.toUpperCase())}
                />
              </Field>
              <Field label="PAN Card" required error={errors.panCard}>
                <input
                  className="form-input font-mono uppercase tracking-wider"
                  placeholder="e.g. AABCT1332L"
                  value={form.panCard}
                  onChange={e => set('panCard', e.target.value.toUpperCase())}
                />
              </Field>
            </FormSection>

            {/* ── Contact Details ── */}
            <FormSection title="Contact Details">
              <Field label="Contact Person" required error={errors.contactPerson}>
                <input
                  className="form-input"
                  placeholder="e.g. Rahul Verma"
                  value={form.contactPerson}
                  onChange={e => set('contactPerson', e.target.value)}
                />
              </Field>
              <Field label="Telephone / Mobile" error={errors.telephone}>
                <input
                  className="form-input"
                  placeholder="e.g. +91 98765 43210"
                  value={form.telephone}
                  onChange={e => set('telephone', e.target.value)}
                />
              </Field>
            </FormSection>

            {/* ── Approvers (create only) ── */}
            {!editingRequest && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3 border-b border-gray-100 pb-1.5">
                  Approvers
                </p>
                <ApprovalChainBuilder
                  approvers={availableApprovers}
                  selected={selectedApprovers}
                  onChange={setSelectedApprovers}
                  error={errors.approvers}
                />
              </div>
            )}

            {editingRequest && (
              <div className="rounded-lg bg-blue-50 ring-1 ring-blue-200 p-3">
                <p className="text-xs text-blue-700">
                  The approval chain is preserved from the original request. Submitting will reset all approver decisions and increment the revision number.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-5">
            <button className="btn-secondary" onClick={() => setShowForm(false)} disabled={submitting}>Cancel</button>
            <button className="btn-primary" onClick={handleSubmitForm} disabled={submitting}>
              <PaperAirplaneIcon className="h-4 w-4" />
              {submitting
                ? (editingRequest ? 'Resubmitting…' : 'Submitting…')
                : (editingRequest ? 'Update & Resubmit for Approval' : 'Submit for Approval')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
