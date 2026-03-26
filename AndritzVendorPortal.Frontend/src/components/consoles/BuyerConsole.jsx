import { useState, useEffect } from 'react'
import { PlusIcon, PaperAirplaneIcon, PencilSquareIcon, EyeIcon,
         ClockIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'
import { ExclamationTriangleIcon, CheckBadgeIcon, CheckCircleIcon } from '@heroicons/react/24/solid'
import Modal from '../shared/Modal'
import StatusBadge from '../shared/StatusBadge'
import VendorDetailModal from '../VendorDetailModal'
import Toast from '../shared/Toast'
import { CITIES, CITY_STATE_MAP } from '../../data/mockData'
import api from '../../services/api'

const EMPTY_FORM = {
  vendorName: '', materialGroup: '', reason: '',
  contactPerson: '', telephone: '',
  gstNumber: '', panCard: '',
  addressDetails: '', postalCode: '', city: '', locality: '', state: '', country: 'India',
  currency: 'INR', paymentTerms: '', incoterms: '', yearlyPvo: '',
  isOneTimeVendor: false, proposedBy: '',
}

const CURRENCIES    = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AED']
const INCOTERMS     = ['EXW','FCA','CPT','CIP','DAP','DPU','DDP','FAS','FOB','CFR','CIF']
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
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3 border-b border-gray-100 pb-1.5">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
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
  const add    = (id) => { const a = approvers.find(x => x.id === id); if (a) onChange([...selected, a]) }
  const remove = (id) => onChange(selected.filter(s => s.id !== id))
  const move   = (i, dir) => {
    const arr = [...selected], j = i + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    onChange(arr)
  }
  return (
    <div className="space-y-3">
      <select className="form-input" value="" onChange={e => { if (e.target.value) add(e.target.value) }}>
        <option value="">+ Add approver to chain…</option>
        {available.map(a => <option key={a.id} value={a.id}>{a.name} ({a.email})</option>)}
      </select>
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
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#096fb3]/10 text-[#096fb3] text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{s.name}</p>
                <p className="text-xs text-gray-400">{s.email}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/></svg>
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === selected.length - 1} className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                </button>
                <button type="button" onClick={() => remove(s.id)} className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
          ))}
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
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

const revLabel = (n) => n === 0 ? 'Original' : `REV ${n}`

export default function BuyerConsole({ workflow, currentUser, activePage, onNavigate }) {
  const myRequests   = workflow.requests.filter(r => r.createdByUserId === currentUser.id)
  const activeReqs   = myRequests.filter(r => r.status !== 'Rejected')
  const rejectedReqs = myRequests.filter(r => r.status === 'Rejected')
  const completedReqs = myRequests.filter(r => r.status === 'Completed')
  const inProgressReqs = activeReqs.filter(r => r.status !== 'Completed')

  const [showForm, setShowForm]                     = useState(false)
  const [editingRequest, setEditingRequest]         = useState(null)
  const [form, setForm]                             = useState(EMPTY_FORM)
  const [selectedApprovers, setSelectedApprovers]   = useState([])
  const [availableApprovers, setAvailableApprovers] = useState([])
  const [viewingRequest, setViewingRequest]         = useState(null)
  const [errors, setErrors]                         = useState({})
  const [submitting, setSubmitting]                 = useState(false)
  const [apiError, setApiError]                     = useState(null)
  const [materialGroups, setMaterialGroups]         = useState([])
  const [proposedByNames, setProposedByNames]       = useState([])
  const [toast, setToast]                           = useState(null)

  useEffect(() => {
    api.get('/users/approvers')
      .then(r => setAvailableApprovers(r.data))
      .catch(() => setToast({ type: 'error', title: 'Could not load approvers', body: 'Failed to fetch the approver list. Please refresh the page.' }))
    api.get('/master-data/material-groups').then(r => setMaterialGroups(r.data)).catch(() => {})
    api.get('/master-data/proposed-by').then(r => setProposedByNames(r.data)).catch(() => {})
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
      vendorName:     req.vendorName     ?? '',
      materialGroup:  req.materialGroup  ?? '',
      reason:         req.reason         ?? '',
      contactPerson:  req.contactPerson  ?? '',
      telephone:      req.telephone      ?? '',
      gstNumber:      req.gstNumber      ?? '',
      panCard:        req.panCard        ?? '',
      addressDetails: req.addressDetails ?? '',
      postalCode:     req.postalCode     ?? '',
      city:           req.city           ?? '',
      locality:       req.locality       ?? '',
      state:          req.state          ?? '',
      country:        req.country        ?? 'India',
      currency:       req.currency       ?? 'INR',
      paymentTerms:   req.paymentTerms   ?? '',
      incoterms:      req.incoterms      ?? '',
      yearlyPvo:      req.yearlyPvo      ?? '',
      isOneTimeVendor:req.isOneTimeVendor ?? false,
      proposedBy:     req.proposedBy     ?? '',
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
    const expectedState = CITY_STATE_MAP[form.city]
    if (expectedState && form.state && form.state !== expectedState)
      e.state = `${form.city} is in ${expectedState}, not ${form.state}.`
    if (!editingRequest && selectedApprovers.length === 0)
      e.approvers = 'Select at least one approver.'
    return e
  }

  const hasFormChanged = () => {
    if (!editingRequest) return true
    const fields = [
      'vendorName','contactPerson','telephone','gstNumber','panCard',
      'addressDetails','postalCode','city','locality','state','country',
      'currency','paymentTerms','incoterms','materialGroup','reason',
      'yearlyPvo','proposedBy',
    ]
    const boolFields = ['isOneTimeVendor']
    return fields.some(f => (form[f] ?? '') !== (editingRequest[f] ?? ''))
        || boolFields.some(f => (form[f] ?? false) !== (editingRequest[f] ?? false))
  }

  const handleSubmitForm = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }

    // Block resubmit if buyer changed nothing
    if (editingRequest && editingRequest.status !== 'Completed' && !hasFormChanged()) {
      setApiError('No changes detected. Please update the required field before resubmitting.')
      return
    }

    setSubmitting(true)
    setApiError(null)
    try {
      if (editingRequest && editingRequest.status === 'Completed') {
        const name = editingRequest.vendorName
        await workflow.updateCompleted(editingRequest.id, form)
        setShowForm(false)
        setToast({ type: 'success', title: 'Details Updated', body: `Vendor details for ${name} have been updated. FinalApprover and Admin have been notified.` })
      } else if (editingRequest) {
        const name = editingRequest.vendorName
        await workflow.resubmit(editingRequest.id, form)
        setShowForm(false)
        setToast({ type: 'success', title: 'Revision Submitted', body: `Your updated request for ${name} has been resubmitted for approval.` })
      } else {
        const name = form.vendorName
        await workflow.createRequest(form, selectedApprovers)
        setShowForm(false)
        setToast({ type: 'success', title: 'Request Submitted', body: `Your vendor registration request for ${name} has been submitted for approval.` })
      }
    } catch (err) {
      const detail = err.response?.data
      // ASP.NET Core model validation returns { errors: { FieldName: ["msg"] } }
      if (detail?.errors && typeof detail.errors === 'object') {
        const fieldMap = {
          VendorName: 'vendorName', ContactPerson: 'contactPerson',
          GstNumber: 'gstNumber', PanCard: 'panCard',
          AddressDetails: 'addressDetails', City: 'city', Locality: 'locality',
          Telephone: 'telephone', PostalCode: 'postalCode', State: 'state',
          MaterialGroup: 'materialGroup', Reason: 'reason',
        }
        const fieldErrors = {}
        for (const [key, msgs] of Object.entries(detail.errors)) {
          const mapped = fieldMap[key] ?? key.charAt(0).toLowerCase() + key.slice(1)
          fieldErrors[mapped] = Array.isArray(msgs) ? msgs[0] : msgs
        }
        if (Object.keys(fieldErrors).length) {
          setErrors(fieldErrors)
          setApiError('Please fix the highlighted fields below.')
        } else {
          setApiError(detail.title ?? 'Request failed. Please check your entries and try again.')
        }
      } else if (Array.isArray(detail))           setApiError(detail.join(' '))
      else if (typeof detail === 'string') setApiError(detail)
      else if (detail?.message)            setApiError(detail.message)
      else                                 setApiError('Request failed. Please check your entries and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Sub-components ───────────────────────────────────────────────────────────

  const RequestCard = ({ req }) => (
    <div className="card overflow-hidden">
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
          <button className="btn-secondary" onClick={() => setViewingRequest(req)}>
            <EyeIcon className="h-4 w-4" />
            View
          </button>
          {req.status === 'Completed' && (
            <button className="btn-secondary" onClick={() => openEdit(req)}>
              <PencilSquareIcon className="h-4 w-4" />
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  )

  const RejectedCard = ({ req }) => (
    <div className="card overflow-hidden">
      <div className="bg-red-50 border-b border-red-100 px-5 py-3 flex items-start gap-3">
        <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-red-800">Request Rejected — Revision Required</p>
          {req.rejectionComment && (
            <p className="text-sm text-red-700 mt-0.5">"{req.rejectionComment}"</p>
          )}
        </div>
      </div>
      <div className="px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold text-gray-900">{req.vendorName}</h2>
            <StatusBadge status={req.status} />
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{revLabel(req.revisionNo)}</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{req.contactPerson || req.contactInformation}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {[req.city, req.locality, req.state].filter(Boolean).join(', ')}
            {' · '}{new Date(req.updatedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button className="btn-secondary" onClick={() => setViewingRequest(req)}>
            <EyeIcon className="h-4 w-4" />
            View
          </button>
          <button className="btn-primary" onClick={() => openEdit(req)}>
            <PencilSquareIcon className="h-4 w-4" />
            Edit &amp; Resubmit
          </button>
        </div>
      </div>
    </div>
  )

  // ── Render ───────────────────────────────────────────────────────────────────

  if (workflow.loading && workflow.requests.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-2 border-[#096fb3] border-t-transparent animate-spin" />
      </div>
    )
  }

  const recentReqs = [...myRequests]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 4)

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* ── Dashboard ───────────────────────────────────────────────────────── */}
      {activePage === 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left column (main) ── */}
          <div className="lg:col-span-2 space-y-5">
            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl ring-1 ring-gray-200 px-5 py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <ClockIcon className="h-5 w-5 text-[#096fb3]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{inProgressReqs.length}</p>
                  <p className="text-xs text-gray-500 mt-0.5">In Progress</p>
                </div>
              </div>
              <div className={`bg-white rounded-xl ring-1 px-5 py-4 flex items-center gap-4 ${rejectedReqs.length > 0 ? 'ring-red-200' : 'ring-gray-200'}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${rejectedReqs.length > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <ExclamationCircleIcon className={`h-5 w-5 ${rejectedReqs.length > 0 ? 'text-red-500' : 'text-gray-400'}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{rejectedReqs.length}</p>
                  <p className={`text-xs mt-0.5 ${rejectedReqs.length > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>Awaiting Revision</p>
                </div>
              </div>
              <div className="bg-white rounded-xl ring-1 ring-gray-200 px-5 py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{completedReqs.length}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Completed</p>
                </div>
              </div>
            </div>

            {/* Recent activity */}
            <div className="bg-white rounded-2xl ring-1 ring-gray-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
                {myRequests.length > 4 && (
                  <button onClick={() => onNavigate('requests')} className="text-xs text-[#096fb3] hover:underline font-medium">
                    View all
                  </button>
                )}
              </div>
              {recentReqs.length > 0 ? (
                <div className="divide-y divide-gray-50">
                  {recentReqs.map(req => (
                    <div key={req.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{req.vendorName}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {[req.city, req.locality].filter(Boolean).join(', ')}
                          {' · '}{new Date(req.updatedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                        </p>
                      </div>
                      <StatusBadge status={req.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center">
                  <p className="text-sm text-gray-400">No requests yet. Use the button on the right to get started.</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Right column (actions + guide) ── */}
          <div className="space-y-5">
            {/* New request CTA */}
            <div className="bg-white rounded-2xl ring-1 ring-gray-200 p-5">
              <p className="text-sm font-semibold text-gray-900 mb-1">Register a Vendor</p>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                Submit a new vendor registration request for approval and SAP onboarding.
              </p>
              <button className="w-full btn-primary justify-center" onClick={openCreate}>
                <PlusIcon className="h-4 w-4" />
                New Request
              </button>
              {rejectedReqs.length > 0 && (
                <button
                  onClick={() => onNavigate('revision')}
                  className="w-full mt-2 flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm font-medium py-2 hover:bg-red-100 transition-colors"
                >
                  <ExclamationCircleIcon className="h-4 w-4" />
                  {rejectedReqs.length} Awaiting Revision
                </button>
              )}
            </div>

            {/* Workflow guide */}
            <div className="bg-white rounded-2xl ring-1 ring-gray-200 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Workflow</p>
              <ol className="space-y-3">
                {[
                  ['Submit',         'Fill in vendor details and assign approvers'],
                  ['Approver Review','Each approver reviews sequentially'],
                  ['Final Approval', 'Pardeep Sharma assigns SAP vendor code'],
                  ['Completed',      'Vendor is onboarded and record is stored'],
                ].map(([title, desc], i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold text-white"
                      style={{ background: '#096fb3' }}>
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-700">{title}</p>
                      <p className="text-[11px] text-gray-400 leading-relaxed">{desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

        </div>
      )}

      {/* ── My Requests ─────────────────────────────────────────────────────── */}
      {activePage === 'requests' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{activeReqs.length} request{activeReqs.length !== 1 ? 's' : ''}</p>
            <button className="btn-primary" onClick={openCreate}>
              <PlusIcon className="h-4 w-4" />
              New Request
            </button>
          </div>
          {activeReqs.length === 0 && (
            <div className="card p-12 text-center text-gray-400">
              <p className="text-sm">No active requests. Click "New Request" to get started.</p>
            </div>
          )}
          {activeReqs.map(req => <RequestCard key={req.id} req={req} />)}
        </div>
      )}

      {/* ── Waiting Revision ────────────────────────────────────────────────── */}
      {activePage === 'revision' && (
        <div className="space-y-4">
          {rejectedReqs.length === 0 && (
            <div className="card p-12 text-center">
              <ExclamationCircleIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No requests waiting for revision.</p>
            </div>
          )}
          {rejectedReqs.map(req => <RejectedCard key={req.id} req={req} />)}
        </div>
      )}

      {/* ── Modals (always rendered regardless of active page) ──────────────── */}
      {viewingRequest && (
        <VendorDetailModal
          request={workflow.requests.find(r => r.id === viewingRequest.id) ?? viewingRequest}
          onClose={() => setViewingRequest(null)}
        />
      )}

      {showForm && (
        <Modal
          title={
            editingRequest?.status === 'Completed'
              ? `Update Vendor Details — ${editingRequest.vendorName}`
              : editingRequest
                ? `Edit & Resubmit — ${editingRequest.vendorName}`
                : 'New Vendor Registration Request'
          }
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
            <FormSection title="Vendor Information">
              <Field label="Supplier Name" required error={errors.vendorName} span={2}>
                <input className="form-input" placeholder="e.g. Tata Components Pvt. Ltd."
                  value={form.vendorName} onChange={e => set('vendorName', e.target.value)} />
              </Field>
              <Field label="Material Group" error={errors.materialGroup}>
                <input className="form-input" list="material-group-list" placeholder="e.g. Raw Materials"
                  value={form.materialGroup} onChange={e => set('materialGroup', e.target.value)} />
                <datalist id="material-group-list">
                  {materialGroups.map(g => <option key={g} value={g} />)}
                </datalist>
              </Field>
              <Field label="Reason for Registration" error={errors.reason}>
                <input className="form-input" placeholder="e.g. New supplier for FY2026"
                  value={form.reason} onChange={e => set('reason', e.target.value)} />
              </Field>
              <Field label="Proposed By" error={errors.proposedBy} span={2}>
                <input className="form-input" list="proposed-by-list" placeholder="Name / department proposing this vendor"
                  value={form.proposedBy} onChange={e => set('proposedBy', e.target.value)} />
                <datalist id="proposed-by-list">
                  {proposedByNames.map(n => <option key={n} value={n} />)}
                </datalist>
              </Field>
              <Field label="" span={2}>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-[#096fb3] focus:ring-[#096fb3]"
                    checked={form.isOneTimeVendor} onChange={e => set('isOneTimeVendor', e.target.checked)} />
                  <span className="text-sm font-medium text-gray-700">One-Time Vendor</span>
                  <span className="text-xs text-gray-400">(not added to permanent vendor master)</span>
                </label>
              </Field>
            </FormSection>

            <FormSection title="Address">
              <Field label="Street / Building / Plot" required error={errors.addressDetails} span={2}>
                <textarea className="form-input resize-none" rows={2} placeholder="Plot No., Building Name, Area"
                  value={form.addressDetails} onChange={e => set('addressDetails', e.target.value)} />
              </Field>
              <Field label="Postal Code" error={errors.postalCode}>
                <input className="form-input" placeholder="e.g. 400001" maxLength={10}
                  value={form.postalCode} onChange={e => set('postalCode', e.target.value)} />
              </Field>
              <Field label="City" required error={errors.city}>
                <input className="form-input" list="city-list" placeholder="e.g. Mumbai"
                  value={form.city} onChange={e => {
                    const city = e.target.value
                    setForm(f => ({ ...f, city, locality: '', ...(CITY_STATE_MAP[city] ? { state: CITY_STATE_MAP[city] } : {}) }))
                  }} />
                <datalist id="city-list">
                  {Object.keys(CITIES).map(c => <option key={c} value={c} />)}
                </datalist>
              </Field>
              <Field label="Locality" required error={errors.locality}>
                <input className="form-input" list="locality-list" placeholder="e.g. Andheri"
                  value={form.locality} onChange={e => set('locality', e.target.value)} />
                <datalist id="locality-list">
                  {(CITIES[form.city] ?? []).map(l => <option key={l} value={l} />)}
                </datalist>
              </Field>
              <Field label="State" error={errors.state || (CITY_STATE_MAP[form.city] && form.state && form.state !== CITY_STATE_MAP[form.city] ? `${form.city} belongs to ${CITY_STATE_MAP[form.city]}` : null)}>
                <select className="form-input" value={form.state} onChange={e => set('state', e.target.value)}>
                  <option value="">Select State</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Country" error={errors.country}>
                <input className="form-input" placeholder="India"
                  value={form.country} onChange={e => set('country', e.target.value)} />
              </Field>
            </FormSection>

            <FormSection title="Commercial Terms">
              <Field label="Currency" error={errors.currency}>
                <select className="form-input" value={form.currency} onChange={e => set('currency', e.target.value)}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Payment Terms" error={errors.paymentTerms}>
                <input className="form-input" placeholder="e.g. Net 30, Advance 50%"
                  value={form.paymentTerms} onChange={e => set('paymentTerms', e.target.value)} />
              </Field>
              <Field label="Incoterms" error={errors.incoterms}>
                <select className="form-input" value={form.incoterms} onChange={e => set('incoterms', e.target.value)}>
                  <option value="">Select Incoterms</option>
                  {INCOTERMS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Yearly PVO" error={errors.yearlyPvo}>
                <input className="form-input" placeholder="e.g. 50,00,000"
                  value={form.yearlyPvo} onChange={e => set('yearlyPvo', e.target.value)} />
              </Field>
            </FormSection>

            <FormSection title="Tax Identification">
              <Field label="GST Number" required error={errors.gstNumber}>
                <input className="form-input font-mono uppercase tracking-wider" placeholder="e.g. 27AABCT1332L1ZV"
                  value={form.gstNumber} onChange={e => set('gstNumber', e.target.value.toUpperCase())} />
              </Field>
              <Field label="PAN Card" required error={errors.panCard}>
                <input className="form-input font-mono uppercase tracking-wider" placeholder="e.g. AABCT1332L"
                  value={form.panCard} onChange={e => set('panCard', e.target.value.toUpperCase())} />
              </Field>
            </FormSection>

            <FormSection title="Contact Details">
              <Field label="Contact Person" required error={errors.contactPerson}>
                <input className="form-input" placeholder="e.g. Rahul Verma"
                  value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} />
              </Field>
              <Field label="Telephone / Mobile" error={errors.telephone}>
                <input className="form-input" placeholder="e.g. +91 98765 43210"
                  value={form.telephone} onChange={e => set('telephone', e.target.value)} />
              </Field>
            </FormSection>

            {!editingRequest && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3 border-b border-gray-100 pb-1.5">Approvers</p>
                <ApprovalChainBuilder
                  approvers={availableApprovers}
                  selected={selectedApprovers}
                  onChange={setSelectedApprovers}
                  error={errors.approvers}
                />
              </div>
            )}

            {editingRequest && editingRequest.status === 'Completed' && (
              <div className="rounded-lg bg-emerald-50 ring-1 ring-emerald-200 p-3">
                <p className="text-xs text-emerald-700">
                  This request is already completed with SAP Vendor Code <strong>{editingRequest.vendorCode}</strong>. Saving will update the vendor details and notify the FinalApprover and Admin. The vendor code and completed status will be preserved.
                </p>
              </div>
            )}
            {editingRequest && editingRequest.status !== 'Completed' && (
              <div className="rounded-lg bg-blue-50 ring-1 ring-blue-200 p-3">
                <p className="text-xs text-[#096fb3]">
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
                ? (editingRequest?.status === 'Completed' ? 'Saving…' : editingRequest ? 'Resubmitting…' : 'Submitting…')
                : (editingRequest?.status === 'Completed' ? 'Save Updates' : editingRequest ? 'Update & Resubmit for Approval' : 'Submit for Approval')}
            </button>
          </div>
        </Modal>
      )}

      {toast && <Toast type={toast.type} title={toast.title} body={toast.body} onClose={() => setToast(null)} />}
    </div>
  )
}
