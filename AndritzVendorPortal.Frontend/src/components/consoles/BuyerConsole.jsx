import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { PlusIcon, PaperAirplaneIcon, PencilSquareIcon, EyeIcon,
         ClockIcon, ExclamationCircleIcon, ChevronDownIcon, ArrowUpTrayIcon, ArrowDownTrayIcon, XMarkIcon,
         ChevronLeftIcon, ChevronRightIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { ExclamationTriangleIcon, CheckBadgeIcon, CheckCircleIcon } from '@heroicons/react/24/solid'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
         Cell } from 'recharts'
import Modal from '../shared/Modal'
import StatusBadge from '../shared/StatusBadge'
import VendorDetailModal from '../VendorDetailModal'
import Toast from '../shared/Toast'
import { CITIES } from '../../data/mockData'
import { Country, State } from 'country-state-city'

const ALL_COUNTRIES = Country.getAllCountries()
const getStates = (isoCode) => State.getStatesOfCountry(isoCode)
import api from '../../services/api'
import { buildMonthlyData } from '../../utils/statsUtils'

const EMPTY_FORM = {
  vendorName: '', materialGroup: '', reason: '',
  contactPerson: '', telephone: '',
  gstNumber: '', panCard: '',
  addressDetails: '', postalCode: '', city: '', locality: '', state: '', country: 'IN',
  currency: 'INR', paymentTerms: '', incoterms: '', yearlyPvo: '',
  isOneTimeVendor: false, proposedBy: '',
}

const CURRENCIES    = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AED']
const INCOTERMS     = ['EXW','FCA','CPT','CIP','DAP','DPU','DDP','FAS','FOB','CFR','CIF']
const ALL_LOCALITIES = [...new Set(Object.values(CITIES).flat())]

const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/

// Maps Excel column headers (lowercase, asterisks stripped) → EMPTY_FORM field names
const EXCEL_COL_MAP = {
  'vendor name':        'vendorName',
  'material group':     'materialGroup',
  'reason':             'reason',
  'contact person':     'contactPerson',
  'telephone':          'telephone',
  'gst number':         'gstNumber',
  'pan card':           'panCard',
  'address details':    'addressDetails',
  'postal code':        'postalCode',
  'city':               'city',
  'locality':           'locality',
  'state':              'state',
  'country':            'country',
  'currency':           'currency',
  'payment terms':      'paymentTerms',
  'incoterms':          'incoterms',
  'yearly pvo':         'yearlyPvo',
  'proposed by':        'proposedBy',
  'is one-time vendor': 'isOneTimeVendor',
}

// Required fields get a red asterisk in the template header
const TEMPLATE_HEADERS = [
  { label: 'Vendor Name *',     required: true  },
  { label: 'Material Group',    required: false },
  { label: 'Reason',            required: false },
  { label: 'Contact Person *',  required: true  },
  { label: 'Telephone',         required: false },
  { label: 'GST Number *',      required: true  },
  { label: 'PAN Card *',        required: true  },
  { label: 'Address Details *', required: true  },
  { label: 'Postal Code',       required: false },
  { label: 'City *',            required: true  },
  { label: 'Locality *',        required: true  },
  { label: 'State',             required: false },
  { label: 'Country',           required: false },
  { label: 'Currency',          required: false },
  { label: 'Payment Terms',     required: false },
  { label: 'Incoterms',         required: false },
  { label: 'Yearly PVO',        required: false },
  { label: 'Proposed By',       required: false },
  { label: 'Is One-Time Vendor',required: false },
]

// Generates and downloads a blank .xlsx template with required-field asterisks
function downloadTemplate() {
  const headers = TEMPLATE_HEADERS.map(h => h.label)
  const sample = [
    'Acme Supplies Pvt Ltd', 'Raw Materials', 'New strategic supplier', 'Rajiv Mehta', '9876543210',
    '27AAAAA0000A1Z5', 'AAAAA1234A', 'Plot 12, Industrial Area, Phase 2', '400001', 'Mumbai', 'Andheri',
    'Maharashtra', 'India', 'INR', 'Net 30', 'FOB', '50,00,000', 'Vikram Nair', 'No',
  ]
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([headers, sample])

  // Style required-field headers red (xlsx supports limited cell styles via xlsx-style or SheetJS Pro;
  // we use a note in the sample row instead to stay with the free SheetJS package)
  ws['!cols'] = headers.map(() => ({ wch: 24 }))

  // Add a legend row below the sample so the user knows * = required
  XLSX.utils.sheet_add_aoa(ws, [['* = Required field. Do not change column headers.']], { origin: 'A3' })
  ws['A3'] = { v: '* = Required field. Do not change column headers.', t: 's' }

  XLSX.utils.book_append_sheet(wb, ws, 'Vendor Request')
  XLSX.writeFile(wb, 'Andritz_Vendor_Request_Template.xlsx')
}

function FormSection({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 border-b border-gray-100 pb-1.5">{title}</p>
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
  const myRequests     = workflow.requests.filter(r => r.createdByUserId === currentUser.id && !r.isArchived)
  const draftReqs      = myRequests.filter(r => r.status === 'Draft')
  const activeReqs     = myRequests.filter(r => r.status !== 'Rejected' && r.status !== 'Draft')
  const rejectedReqs   = myRequests.filter(r => r.status === 'Rejected')
  const completedReqs  = myRequests.filter(r => r.status === 'Completed')
  const inProgressReqs = activeReqs.filter(r => r.status !== 'Completed')

  const [showForm, setShowForm]                     = useState(false)
  const [editingRequest, setEditingRequest]         = useState(null)
  const [form, setForm]                             = useState(EMPTY_FORM)
  const [requestsFilter, setRequestsFilter]         = useState('All')
  const [selectedApprovers, setSelectedApprovers]   = useState([])
  const [availableApprovers, setAvailableApprovers] = useState([])
  const [chainNeedsRebuild, setChainNeedsRebuild]   = useState(false)
  const [viewingRequest, setViewingRequest]         = useState(null)
  const [errors, setErrors]                         = useState({})
  const [submitting, setSubmitting]                 = useState(false)
  const [savingDraft, setSavingDraft]               = useState(false)
  const [apiError, setApiError]                     = useState(null)
  const [materialGroups, setMaterialGroups]         = useState([])
  const [proposedByNames, setProposedByNames]       = useState([])
  const [toast, setToast]                           = useState(null)
  const [showImportDialog, setShowImportDialog]     = useState(false)
  const [importErrors, setImportErrors]             = useState([])
  const importFileRef                               = useRef(null)
  const [reqsPage, setReqsPage]                     = useState(1)
  const [revPage, setRevPage]                       = useState(1)
  const [reqsSearch, setReqsSearch]                 = useState('')
  const [revSearch, setRevSearch]                   = useState('')
  const [reqsDateFrom, setReqsDateFrom]             = useState('')
  const [reqsDateTo, setReqsDateTo]                 = useState('')
  const [revDateFrom, setRevDateFrom]               = useState('')
  const [revDateTo, setRevDateTo]                   = useState('')
  const [showNoApproverConfirm, setShowNoApproverConfirm] = useState(false)

  const PAGE_SIZE = 10

  const handleImportExcel = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const wb   = XLSX.read(evt.target.result, { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
        // Skip empty rows and the legend row ("* = Required field…" sits in the
        // Vendor Name column — its value starts with "*").
        const dataRows = rows.filter(row => {
          const nameKey = Object.keys(row).find(k =>
            EXCEL_COL_MAP[k.trim().replace(/\s*\*\s*$/, '').toLowerCase()] === 'vendorName'
          )
          const nameVal = nameKey ? String(row[nameKey]).trim() : ''
          return nameVal && !nameVal.startsWith('*')
        })
        if (!dataRows.length) {
          setImportErrors(['The spreadsheet has no data rows. Please fill in row 2 of the template.'])
          return
        }
        if (dataRows.length > 1) {
          setImportErrors([
            `The spreadsheet contains ${dataRows.length} data rows. Only 1 vendor can be imported at a time — each vendor requires its own approver chain. Please keep only one data row in the file.`,
          ])
          return
        }
        const row    = dataRows[0]
        const parsed = { ...EMPTY_FORM }
        for (const [col, val] of Object.entries(row)) {
          // Strip trailing asterisk from header before lookup
          const key   = col.trim().replace(/\s*\*\s*$/, '').toLowerCase()
          const field = EXCEL_COL_MAP[key]
          if (!field) continue
          if (field === 'isOneTimeVendor') {
            const v = String(val).trim().toLowerCase()
            parsed[field] = v === 'true' || v === 'yes' || v === '1' || val === 1
          } else if (field === 'country') {
            parsed[field] = ALL_COUNTRIES.find(c => c.name === String(val))?.isoCode ?? 'IN'
          } else {
            parsed[field] = String(val)
          }
        }

        // Validate required fields + formats
        const errs = []
        if (!parsed.vendorName.trim())     errs.push('Vendor Name is required.')
        if (/\d/.test(parsed.vendorName))  errs.push('Vendor Name should not contain numbers.')
        if (!parsed.contactPerson.trim())  errs.push('Contact Person is required.')
        else if (/\d/.test(parsed.contactPerson)) errs.push('Contact Person should not contain numbers — enter a person\'s name, not a number.')
        if (parsed.telephone.trim() && !/^[0-9+\-()\s]+$/.test(parsed.telephone.trim()))
          errs.push('Telephone / Mobile should contain only digits, spaces, and +, -, (, ) characters.')
        if (!parsed.gstNumber.trim())      errs.push('GST Number is required.')
        else if (!GST_RE.test(parsed.gstNumber.trim()))
          errs.push('GST Number format is invalid (expected: 22AAAAA0000A1Z5).')
        if (!parsed.panCard.trim())        errs.push('PAN Card is required.')
        else if (!PAN_RE.test(parsed.panCard.trim()))
          errs.push('PAN Card format is invalid (expected: ABCDE1234F).')
        if (!parsed.addressDetails.trim()) errs.push('Address Details is required.')
        if (!parsed.city.trim())           errs.push('City is required.')
        if (!parsed.locality.trim())       errs.push('Locality is required.')

        if (errs.length) {
          setImportErrors(errs)
          return
        }

        // All good — close dialog, open form pre-filled
        setShowImportDialog(false)
        setImportErrors([])
        openCreate()
        setTimeout(() => {
          setForm(parsed)
          setToast({ type: 'success', title: 'Form pre-filled from Excel', body: 'Please review all fields before submitting.' })
        }, 50)
      } catch {
        setImportErrors(['Could not read the file. Make sure you are uploading the official Andritz template (.xlsx).'])
      }
    }
    reader.readAsArrayBuffer(file)
  }

  useEffect(() => {
    api.get('/users/approvers')
      .then(r => setAvailableApprovers(r.data))
      .catch(() => setToast({ type: 'error', title: 'Could not load approvers', body: 'Failed to fetch the approver list. Please refresh the page.' }))
    api.get('/master-data/material-groups').then(r => setMaterialGroups(r.data)).catch(() => {})
    api.get('/master-data/proposed-by').then(r => setProposedByNames(r.data)).catch(() => {})
  }, [])

  const set = (field, value) => {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(prev => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const openCreate = () => {
    setEditingRequest(null)
    setForm(EMPTY_FORM)
    setSelectedApprovers([])
    setChainNeedsRebuild(false)
    setErrors({})
    setApiError(null)
    setShowForm(true)
  }

  const openEdit = (req) => {
    setEditingRequest(req)

    // Detect stale approvers: intermediate steps whose userId is no longer in availableApprovers
    const intermediateSteps = (req.approvalSteps ?? []).filter(s => !s.isFinalApproval)
    const availableIds = new Set(availableApprovers.map(a => a.id))
    const stale = intermediateSteps.filter(s => !availableIds.has(s.approverUserId))
    const needsRebuild = stale.length > 0
    setChainNeedsRebuild(needsRebuild)

    if (req.status === 'Draft') {
      // For drafts, always pre-populate the approver chain so the buyer can edit it
      const validSteps = intermediateSteps
        .filter(s => availableIds.has(s.approverUserId))
        .sort((a, b) => a.stepOrder - b.stepOrder)
      setSelectedApprovers(validSteps.map(s => ({
        id: s.approverUserId, name: s.approverName,
        email: availableApprovers.find(a => a.id === s.approverUserId)?.email ?? '',
      })))
    } else if (needsRebuild) {
      // Pre-populate with the still-valid approvers in original order
      const validSteps = intermediateSteps
        .filter(s => availableIds.has(s.approverUserId))
        .sort((a, b) => a.stepOrder - b.stepOrder)
      setSelectedApprovers(validSteps.map(s => ({
        id: s.approverUserId, name: s.approverName,
        email: availableApprovers.find(a => a.id === s.approverUserId)?.email ?? '',
      })))
    } else {
      setSelectedApprovers([])
    }

    setForm({
      vendorName:     req.vendorName     ?? '',
      materialGroup:  req.materialGroup  ?? '',
      reason:         req.reason         ?? '',
      contactPerson:  req.contactPerson  || req.contactInformation || '',
      telephone:      req.telephone      ?? '',
      gstNumber:      req.gstNumber      ?? '',
      panCard:        req.panCard        ?? '',
      addressDetails: req.addressDetails ?? '',
      postalCode:     req.postalCode     ?? '',
      city:           req.city           ?? '',
      locality:       req.locality       ?? '',
      state:          req.state          ?? '',
      country:        ALL_COUNTRIES.find(c => c.name === req.country)?.isoCode ?? 'IN',
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
    else if (!GST_RE.test(form.gstNumber.trim())) e.gstNumber = 'GST must be in the format 22AAAAA0000A1Z5 (15 characters).'
    if (!form.panCard.trim())        e.panCard        = 'PAN Card is required.'
    else if (!PAN_RE.test(form.panCard.trim()))   e.panCard   = 'PAN must be in the format ABCDE1234F (10 characters).'
    if (!form.addressDetails.trim()) e.addressDetails = 'Address is required.'
    if (!form.city.trim())           e.city           = 'City is required.'
    if (!form.locality.trim())       e.locality       = 'Locality is required.'
    // approvers: warn only if chain rebuild is required (stale approver case)
    if (chainNeedsRebuild && selectedApprovers.length === 0)
      e.approvers = 'The original approval chain has stale approvers — please select at least one approver to rebuild the chain.'
    return e
  }

  const hasFormChanged = () => {
    if (!editingRequest) return true
    // Build a snapshot of the original request in the same shape as `form`
    // (country is stored as a full name on the request but as an ISO code in the form)
    const original = {
      vendorName:     editingRequest.vendorName     ?? '',
      contactPerson:  editingRequest.contactPerson  || editingRequest.contactInformation || '',
      telephone:      editingRequest.telephone      ?? '',
      gstNumber:      editingRequest.gstNumber      ?? '',
      panCard:        editingRequest.panCard        ?? '',
      addressDetails: editingRequest.addressDetails ?? '',
      postalCode:     editingRequest.postalCode     ?? '',
      city:           editingRequest.city           ?? '',
      locality:       editingRequest.locality       ?? '',
      state:          editingRequest.state          ?? '',
      country:        ALL_COUNTRIES.find(c => c.name === editingRequest.country)?.isoCode ?? 'IN',
      currency:       editingRequest.currency       ?? 'INR',
      paymentTerms:   editingRequest.paymentTerms   ?? '',
      incoterms:      editingRequest.incoterms      ?? '',
      materialGroup:  editingRequest.materialGroup  ?? '',
      reason:         editingRequest.reason         ?? '',
      yearlyPvo:      editingRequest.yearlyPvo      ?? '',
      proposedBy:     editingRequest.proposedBy     ?? '',
      isOneTimeVendor:editingRequest.isOneTimeVendor ?? false,
    }
    const strFields = [
      'vendorName','contactPerson','telephone','gstNumber','panCard',
      'addressDetails','postalCode','city','locality','state','country',
      'currency','paymentTerms','incoterms','materialGroup','reason',
      'yearlyPvo','proposedBy',
    ]
    return strFields.some(f => (form[f] ?? '') !== (original[f] ?? ''))
        || (form.isOneTimeVendor ?? false) !== (original.isOneTimeVendor ?? false)
  }

  const handleSubmitForm = async (skipApproverConfirm = false) => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); setApiError('Please fill in all required fields highlighted below.'); return }

    // Block resubmit if buyer changed nothing
    if (editingRequest && editingRequest.status === 'Rejected' && !hasFormChanged()) {
      setApiError('No changes detected. Please edit at least one field before resubmitting a rejected request.')
      return
    }

    // If no intermediate approvers selected, ask for confirmation first (new requests only)
    if (!skipApproverConfirm && !editingRequest && selectedApprovers.length === 0) {
      setShowNoApproverConfirm(true)
      return
    }
    // Also confirm for Draft submissions with no intermediate approvers
    if (!skipApproverConfirm && editingRequest?.status === 'Draft' && selectedApprovers.length === 0) {
      setShowNoApproverConfirm(true)
      return
    }

    setSubmitting(true)
    setApiError(null)
    const payload = { ...form, country: Country.getCountryByCode(form.country)?.name ?? form.country }
    try {
      if (editingRequest && editingRequest.status === 'Completed') {
        const name = editingRequest.vendorName
        await workflow.updateCompleted(editingRequest.id, payload)
        setShowForm(false)
        setToast({ type: 'success', title: 'Details Updated', body: `Vendor details for ${name} have been updated. Final Approver and Admin have been notified.` })
      } else if (editingRequest?.status === 'Draft') {
        // Update the draft fields then submit it
        const name = form.vendorName || editingRequest.vendorName || 'Draft'
        await workflow.saveDraft(payload, selectedApprovers, editingRequest.id)
        await workflow.submit(editingRequest.id)
        setShowForm(false)
        setToast({ type: 'success', title: 'Request Submitted', body: `Your vendor registration request for ${name} has been submitted for approval.` })
      } else if (editingRequest) {
        const name = editingRequest.vendorName
        const resubmitPayload = chainNeedsRebuild
          ? { ...payload, approverUserIds: selectedApprovers.map(a => a.id) }
          : payload
        await workflow.resubmit(editingRequest.id, resubmitPayload)
        setShowForm(false)
        setToast({ type: 'success', title: 'Revision Submitted', body: `Your updated request for ${name} has been resubmitted for approval.` })
      } else {
        const name = form.vendorName
        await workflow.createRequest(payload, selectedApprovers)
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

  const handleSaveDraft = async () => {
    setSavingDraft(true)
    setApiError(null)
    const payload = { ...form, country: Country.getCountryByCode(form.country)?.name ?? form.country }
    try {
      const name = form.vendorName?.trim() || 'Untitled Draft'
      await workflow.saveDraft(payload, selectedApprovers, editingRequest?.status === 'Draft' ? editingRequest.id : null)
      setShowForm(false)
      setToast({ type: 'success', title: 'Draft Saved', body: `"${name}" has been saved as a draft. You can submit it when ready.` })
    } catch (err) {
      const detail = err.response?.data
      setApiError(typeof detail === 'string' ? detail : detail?.message ?? 'Failed to save draft.')
    } finally {
      setSavingDraft(false)
    }
  }

  const matchesSearch = (req, q) => {
    if (!q.trim()) return true
    const lq = q.toLowerCase()
    return (
      req.vendorName?.toLowerCase().includes(lq) ||
      req.contactPerson?.toLowerCase().includes(lq) ||
      req.contactInformation?.toLowerCase().includes(lq) ||
      req.city?.toLowerCase().includes(lq) ||
      req.locality?.toLowerCase().includes(lq)
    )
  }

  const matchesDateRange = (req, dateFrom, dateTo) => {
    if (!dateFrom && !dateTo) return true
    const d = new Date(req.createdAt)
    if (dateFrom && d < new Date(dateFrom)) return false
    if (dateTo   && d > new Date(dateTo + 'T23:59:59')) return false
    return true
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
    .slice(0, 5)

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* ── Dashboard ───────────────────────────────────────────────────────── */}
      {activePage === 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">

          {/* ── Left column (main) ── */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            {/* Stat cards */}
            <div className={`grid gap-4 ${draftReqs.length > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
              {draftReqs.length > 0 && (
                <button
                  onClick={() => { setRequestsFilter('Draft'); onNavigate('requests') }}
                  className="bg-white rounded-xl ring-1 ring-gray-200 px-5 py-4 flex items-center gap-4 hover:ring-2 hover:ring-slate-600 transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                    <PencilSquareIcon className="h-5 w-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{draftReqs.length}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Drafts</p>
                  </div>
                </button>
              )}
              <button
                onClick={() => { setRequestsFilter('Pending'); onNavigate('requests') }}
                className="bg-white rounded-xl ring-1 ring-gray-200 px-5 py-4 flex items-center gap-4 hover:ring-2 hover:ring-slate-600 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <ClockIcon className="h-5 w-5 text-[#096fb3]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{inProgressReqs.length}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Pending</p>
                </div>
              </button>
              <button
                onClick={() => onNavigate('revision')}
                className={`bg-white rounded-xl ring-1 px-5 py-4 flex items-center gap-4 hover:ring-2 hover:ring-slate-600 transition-all text-left ${rejectedReqs.length > 0 ? 'ring-red-200' : 'ring-gray-200'}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${rejectedReqs.length > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <ExclamationCircleIcon className={`h-5 w-5 ${rejectedReqs.length > 0 ? 'text-red-500' : 'text-gray-400'}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{rejectedReqs.length}</p>
                  <p className={`text-xs mt-0.5 ${rejectedReqs.length > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>Awaiting Revision</p>
                </div>
              </button>
              <button
                onClick={() => { setRequestsFilter('Completed'); onNavigate('requests') }}
                className="bg-white rounded-xl ring-1 ring-gray-200 px-5 py-4 flex items-center gap-4 hover:ring-2 hover:ring-slate-600 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{completedReqs.length}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Completed</p>
                </div>
              </button>
            </div>

            {/* Monthly requests chart */}
            <div className="bg-white rounded-2xl ring-1 ring-gray-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">My Requests — Last 6 Months</h3>
              </div>
              <div className="px-2 py-4">
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={buildMonthlyData(myRequests)} barSize={28} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: '#f0f7ff' }}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                      formatter={(v) => [v, 'Requests']}
                    />
                    <Bar dataKey="count" fill="#096fb3" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent activity */}
            <div className="bg-white rounded-2xl ring-1 ring-gray-200 overflow-hidden flex-1">
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
          <div className="flex flex-col gap-5">
            {/* Material type horizontal bar chart */}
            {myRequests.length > 0 && (() => {
              const BAR_COLORS = ['#096fb3','#f59e0b','#10b981','#ef4444','#8b5cf6','#f97316','#06b6d4','#84cc16']
              const counts = {}
              myRequests.forEach(r => {
                const k = r.materialGroup?.trim() || 'Unspecified'
                counts[k] = (counts[k] ?? 0) + 1
              })
              const barData = Object.entries(counts)
                .map(([name, value], i) => ({ name, value, fill: BAR_COLORS[i % BAR_COLORS.length] }))
                .sort((a, b) => b.value - a.value)
              const chartHeight = Math.max(160, barData.length * 36)
              return (
                <div className="bg-white rounded-2xl ring-1 ring-gray-200 p-5">
                  <p className="text-sm font-semibold text-gray-900 mb-3">My Requests by Material</p>
                  <ResponsiveContainer width="100%" height={chartHeight}>
                    <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} domain={[0, 'dataMax+1']} />
                      <YAxis type="category" dataKey="name" width={130} axisLine={false} tickLine={false}
                        tick={({ x, y, payload }) => (
                          <text x={x} y={y} dy={4} textAnchor="end" fill="#6b7280" fontSize={10}>
                            {payload.value.length > 18 ? payload.value.slice(0, 17) + '…' : payload.value}
                          </text>
                        )}
                      />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} formatter={v => [v, 'Requests']} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
                        {barData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )
            })()}
            {/* Workflow guide */}
            <div className="bg-white rounded-2xl ring-1 ring-gray-200 p-5 flex-1">
              <p className="text-sm font-semibold text-gray-900 mb-5">Workflow</p>
              <div className="flex flex-col">
                {[
                  { icon: PaperAirplaneIcon, title: 'Submit',          desc: 'Fill in vendor details and assign approvers' },
                  { icon: EyeIcon,           title: 'Approver Review', desc: 'Each approver reviews sequentially'          },
                  { icon: CheckBadgeIcon,    title: 'Final Approval',  desc: 'Pardeep Sharma assigns SAP vendor code'     },
                  { icon: CheckCircleIcon,   title: 'Completed',       desc: 'Vendor is onboarded and record is stored'   },
                ].map(({ icon: Icon, title, desc }, i, arr) => (
                  <div key={i}>
                    {/* Step */}
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                         style={{ background: 'linear-gradient(135deg,#eef5fb 0%,#f7fafd 100%)', border: '1px solid #d0e4f5' }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                           style={{ background: '#096fb3' }}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-800 leading-tight">{title}</p>
                        <p className="text-[10px] text-gray-400 leading-relaxed mt-0.5">{desc}</p>
                      </div>
                    </div>
                    {/* Arrow connector */}
                    {i < arr.length - 1 && (
                      <div className="flex items-center justify-center py-0.5">
                        <ChevronDownIcon className="h-4 w-4" style={{ color: '#096fb3' }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── My Requests ─────────────────────────────────────────────────────── */}
      {activePage === 'requests' && (() => {
        const allForTab = [...draftReqs, ...activeReqs]
        const filteredReqs = allForTab.filter(r => {
          const statusMatch = requestsFilter === 'Pending'   ? (r.status !== 'Completed' && r.status !== 'Draft')
            : requestsFilter === 'Completed' ? r.status === 'Completed'
            : requestsFilter === 'Draft'     ? r.status === 'Draft'
            : true
          return statusMatch && matchesSearch(r, reqsSearch) && matchesDateRange(r, reqsDateFrom, reqsDateTo)
        })
        const totalPages = Math.max(1, Math.ceil(filteredReqs.length / PAGE_SIZE))
        const paginated  = filteredReqs.slice((reqsPage - 1) * PAGE_SIZE, reqsPage * PAGE_SIZE)
        return (
          <div className="space-y-4">
            {/* Controls row */}
            <div className="flex flex-row items-center justify-between gap-3">
              <div className="flex flex-row items-center gap-2 overflow-x-auto">
                <div className="flex gap-1.5">
                  {['All', 'Draft', 'Pending', 'Completed'].map(f => (
                    <button
                      key={f}
                      onClick={() => { setRequestsFilter(f); setReqsPage(1) }}
                      className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                        requestsFilter === f
                          ? 'bg-slate-700 text-white ring-slate-700'
                          : 'bg-white text-gray-600 ring-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input type="text" placeholder="Search…" value={reqsSearch}
                    onChange={e => { setReqsSearch(e.target.value); setReqsPage(1) }}
                    className="form-input pl-9 text-sm w-44" />
                </div>
                <input type="date" value={reqsDateFrom} onChange={e => { setReqsDateFrom(e.target.value); setReqsPage(1) }}
                  className="form-input text-sm w-36 shrink-0" title="From date" />
                <input type="date" value={reqsDateTo} onChange={e => { setReqsDateTo(e.target.value); setReqsPage(1) }}
                  className="form-input text-sm w-36 shrink-0" title="To date" />
              </div>
              <div className="flex items-center gap-2">
                <button className="btn-secondary" onClick={() => { setImportErrors([]); setShowImportDialog(true) }}>
                  <ArrowUpTrayIcon className="h-4 w-4" />
                  Import Request
                </button>
                <button className="btn-primary" onClick={openCreate}>
                  <PlusIcon className="h-4 w-4" />
                  New Request
                </button>
              </div>
            </div>

            {filteredReqs.length === 0 ? (
              <div className="card p-12 text-center text-gray-400">
                <p className="text-sm">{reqsSearch || reqsDateFrom || reqsDateTo ? 'No results match the filters.' : allForTab.length === 0 ? 'No requests yet. Click "New Request" to get started.' : `No ${requestsFilter.toLowerCase()} requests.`}</p>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 divide-x divide-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Material Group</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Created On</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {paginated.map((req, idx) => {
                      const serial = (reqsPage - 1) * PAGE_SIZE + idx + 1
                      const isDraft = req.status === 'Draft'
                      return (
                        <tr key={req.id} className="hover:bg-gray-50 transition-colors divide-x divide-gray-200">
                          <td className="px-4 py-3 text-xs text-gray-400 font-mono">{serial}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-gray-900">{req.vendorName || <span className="text-gray-400 italic">Untitled</span>}</p>
                              {req.revisionNo > 0 && (
                                <span className="text-xs bg-amber-50 text-amber-700 ring-1 ring-amber-200 ring-inset px-2 py-0.5 rounded-full">REV {req.revisionNo}</span>
                              )}
                              {req.status === 'Completed' && req.vendorCode && (
                                <span className="text-xs bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 ring-inset font-mono px-2 py-0.5 rounded-full">{req.vendorCode}</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">{req.contactPerson || req.contactInformation}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{[req.city, req.locality].filter(Boolean).join(', ') || '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{req.materialGroup || '—'}</td>
                          <td className="px-4 py-3">
                            {isDraft
                              ? <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ring-1 ring-inset bg-gray-100 text-gray-600 ring-gray-300">Draft</span>
                              : <StatusBadge status={req.status} />
                            }
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                            {new Date(req.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {!isDraft && (
                                <button className="btn-secondary !py-1 !px-2 !text-xs" onClick={() => setViewingRequest(req)}>
                                  <EyeIcon className="h-3.5 w-3.5" />
                                  View
                                </button>
                              )}
                              {isDraft && (
                                <button className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-white bg-[#096fb3] hover:bg-[#075d99] transition-colors" onClick={() => openEdit(req)}>
                                  <PencilSquareIcon className="h-3.5 w-3.5" />
                                  Edit &amp; Submit
                                </button>
                              )}
                              {req.status === 'Completed' && (
                                <button className="btn-secondary !py-1 !px-2 !text-xs" onClick={() => openEdit(req)}>
                                  <PencilSquareIcon className="h-3.5 w-3.5" />
                                  Edit
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                  <span className="text-xs text-gray-400">Showing {filteredReqs.length === 0 ? 0 : (reqsPage - 1) * PAGE_SIZE + 1}–{Math.min(reqsPage * PAGE_SIZE, filteredReqs.length)} of {filteredReqs.length}</span>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button className="inline-flex items-center justify-center rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" disabled={reqsPage === 1} onClick={() => setReqsPage(p => p - 1)}><ChevronLeftIcon className="h-4 w-4" /></button>
                      <span className="text-xs text-gray-500 px-1">Page {reqsPage} of {totalPages}</span>
                      <button className="inline-flex items-center justify-center rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" disabled={reqsPage === totalPages} onClick={() => setReqsPage(p => p + 1)}><ChevronRightIcon className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Waiting Revision ────────────────────────────────────────────────── */}
      {activePage === 'revision' && (() => {
        const filteredRev = rejectedReqs.filter(r => matchesSearch(r, revSearch) && matchesDateRange(r, revDateFrom, revDateTo))
        const totalPages  = Math.max(1, Math.ceil(filteredRev.length / PAGE_SIZE))
        const paginated   = filteredRev.slice((revPage - 1) * PAGE_SIZE, revPage * PAGE_SIZE)
        return (
        <div className="space-y-4">
          <div className="flex flex-row items-center gap-2 overflow-x-auto">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 ring-1 ring-red-200 text-red-700 text-sm font-semibold px-4 py-2 select-none">
              <ExclamationCircleIcon className="h-4 w-4" />
              {filteredRev.length} Awaiting Revision
            </span>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input type="text" placeholder="Search requests…" value={revSearch}
                onChange={e => { setRevSearch(e.target.value); setRevPage(1) }}
                className="form-input pl-9 text-sm w-44" />
            </div>
            <input type="date" value={revDateFrom} onChange={e => { setRevDateFrom(e.target.value); setRevPage(1) }}
              className="form-input text-sm w-36 shrink-0" title="From date" />
            <input type="date" value={revDateTo} onChange={e => { setRevDateTo(e.target.value); setRevPage(1) }}
              className="form-input text-sm w-36 shrink-0" title="To date" />
          </div>
          {filteredRev.length === 0 ? (
            <div className="card p-12 text-center">
              <ExclamationCircleIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">{revSearch || revDateFrom || revDateTo ? 'No results match the filters.' : 'No requests waiting for revision.'}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 divide-x divide-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Rejection Reason</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Rejected On</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {paginated.map((req, idx) => {
                    const serial = (revPage - 1) * PAGE_SIZE + idx + 1
                    return (
                      <tr key={req.id} className="hover:bg-red-50/30 transition-colors divide-x divide-gray-200">
                        <td className="px-4 py-3 text-xs text-gray-400 font-mono">{serial}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{req.vendorName}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{req.contactPerson || req.contactInformation}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-red-600 italic max-w-xs truncate">{req.rejectionComment || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{[req.city, req.locality].filter(Boolean).join(', ') || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                          {new Date(req.updatedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button className="btn-secondary !py-1 !px-2 !text-xs" onClick={() => setViewingRequest(req)}>
                              <EyeIcon className="h-3.5 w-3.5" />
                              View
                            </button>
                            <button className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-white bg-[#096fb3] hover:bg-[#075d99] transition-colors" onClick={() => openEdit(req)}>
                              <PencilSquareIcon className="h-3.5 w-3.5" />
                              Edit &amp; Resubmit
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                <span className="text-xs text-gray-400">Showing {filteredRev.length === 0 ? 0 : (revPage - 1) * PAGE_SIZE + 1}–{Math.min(revPage * PAGE_SIZE, filteredRev.length)} of {filteredRev.length}</span>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button className="inline-flex items-center justify-center rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" disabled={revPage === 1} onClick={() => setRevPage(p => p - 1)}><ChevronLeftIcon className="h-4 w-4" /></button>
                    <span className="text-xs text-gray-500 px-1">Page {revPage} of {totalPages}</span>
                    <button className="inline-flex items-center justify-center rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" disabled={revPage === totalPages} onClick={() => setRevPage(p => p + 1)}><ChevronRightIcon className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        )
      })()}

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
              : editingRequest?.status === 'Draft'
                ? `Edit Draft — ${editingRequest.vendorName || 'Untitled'}`
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
                  value={form.proposedBy} onChange={e => set('proposedBy', e.target.value.replace(/[^a-zA-Z\s]/g, ''))} />
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
                  value={form.postalCode} onChange={e => set('postalCode', e.target.value.replace(/\D/g, ''))} />
              </Field>
              <Field label="Country" error={errors.country}>
                <select className="form-input" value={form.country} onChange={e => {
                  setForm(f => ({ ...f, country: e.target.value, state: '', city: '', locality: '' }))
                }}>
                  {ALL_COUNTRIES.map(c => <option key={c.isoCode} value={c.isoCode}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="State" error={errors.state}>
                {getStates(form.country).length > 0 ? (
                  <select className="form-input" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value, city: '', locality: '' }))}>
                    <option value="">Select State</option>
                    {getStates(form.country).map(s => <option key={s.isoCode} value={s.name}>{s.name}</option>)}
                  </select>
                ) : (
                  <input className="form-input" placeholder="Enter state / province" value={form.state} onChange={e => set('state', e.target.value)} />
                )}
              </Field>
              <Field label="City" required error={errors.city}>
                <input className="form-input" placeholder="Enter city" value={form.city} onChange={e => set('city', e.target.value.replace(/[^a-zA-Z\s]/g, ''))} />
              </Field>
              <Field label="Locality" required error={errors.locality}>
                <input className="form-input" list="locality-list" placeholder="Type or select locality"
                  value={form.locality} onChange={e => set('locality', e.target.value)} />
                <datalist id="locality-list">
                  {ALL_LOCALITIES.map(l => <option key={l} value={l} />)}
                </datalist>
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
                  value={form.yearlyPvo} onChange={e => set('yearlyPvo', e.target.value.replace(/[^0-9,]/g, ''))} />
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
                  value={form.contactPerson}
                  onChange={e => set('contactPerson', e.target.value.replace(/[^a-zA-Z\s.''-]/g, ''))} />
              </Field>
              <Field label="Telephone / Mobile" error={errors.telephone}>
                <input className="form-input" placeholder="e.g. 9876543210" inputMode="numeric"
                  value={form.telephone}
                  onChange={e => set('telephone', e.target.value.replace(/[^0-9+\-() ]/g, ''))} />
              </Field>
            </FormSection>

            {(!editingRequest || editingRequest?.status === 'Draft' || chainNeedsRebuild) && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3 border-b border-gray-100 pb-1.5">Approvers</p>
                {chainNeedsRebuild && (
                  <div className="rounded-lg bg-amber-50 ring-1 ring-amber-300 p-3 mb-3">
                    <p className="text-xs text-amber-800 font-medium">
                      One or more approvers from the original chain have been removed. Please confirm the new approval chain before resubmitting.
                    </p>
                  </div>
                )}
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
                  This request is already completed with SAP Vendor Code <strong>{editingRequest.vendorCode}</strong>. Saving will update the vendor details and notify the Final Approver and Admin. The vendor code and completed status will be preserved.
                </p>
              </div>
            )}
            {editingRequest && editingRequest.status !== 'Completed' && editingRequest.status !== 'Draft' && !chainNeedsRebuild && (
              <div className="rounded-lg bg-blue-50 ring-1 ring-blue-200 p-3">
                <p className="text-xs text-[#096fb3]">
                  The approval chain is preserved from the original request. Submitting will reset all approver decisions and increment the revision number.
                </p>
              </div>
            )}
            {editingRequest?.status === 'Draft' && (
              <div className="rounded-lg bg-gray-50 ring-1 ring-gray-200 p-3">
                <p className="text-xs text-gray-600">
                  This is a draft. You can save your progress or submit when ready. No notifications will be sent until you submit.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-between gap-3 border-t border-gray-100 pt-5">
            <button className="btn-secondary" onClick={() => setShowForm(false)} disabled={submitting || savingDraft}>Cancel</button>
            <div className="flex items-center gap-3">
              {/* Show "Save as Draft" only for new requests or existing drafts */}
              {(!editingRequest || editingRequest?.status === 'Draft') && (
                <button
                  className="btn-secondary"
                  onClick={handleSaveDraft}
                  disabled={submitting || savingDraft}
                >
                  <PencilSquareIcon className="h-4 w-4" />
                  {savingDraft ? 'Saving Draft…' : 'Save as Draft'}
                </button>
              )}
              <button className="btn-primary" onClick={() => handleSubmitForm(false)} disabled={submitting || savingDraft}>
                <PaperAirplaneIcon className="h-4 w-4" />
                {submitting
                  ? (editingRequest?.status === 'Completed' ? 'Saving…' : editingRequest ? 'Resubmitting…' : 'Submitting…')
                  : (editingRequest?.status === 'Completed' ? 'Save Updates' : editingRequest?.status === 'Draft' ? 'Submit for Approval' : editingRequest ? 'Update & Resubmit for Approval' : 'Submit for Approval')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── No-Approver Confirmation Dialog ─────────────────────────────────── */}
      {showNoApproverConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Submit without intermediate approvers?</h3>
                <p className="text-sm text-gray-500 mt-1">
                  You haven't added any intermediate approvers. The request will go directly to Pardeep Sharma (Final Approver) for review. Are you sure you want to proceed?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => setShowNoApproverConfirm(false)}>Go Back</button>
              <button
                className="btn-primary"
                onClick={() => { setShowNoApproverConfirm(false); handleSubmitForm(true) }}
              >
                <PaperAirplaneIcon className="h-4 w-4" />
                Yes, Submit Directly
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast type={toast.type} title={toast.title} body={toast.body} onClose={() => setToast(null)} />}

      {/* ── Excel Import Dialog ─────────────────────────────────────────────── */}
      {showImportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Import Request</h3>
                <p className="text-xs text-gray-500 mt-0.5">Fill in the template and upload it to pre-fill the form.</p>
              </div>
              <button
                onClick={() => setShowImportDialog(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Step 1 */}
            <div className="rounded-xl border border-gray-200 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Step 1 — Download Template</p>
              <p className="text-sm text-gray-600">
                Download the official template. Fields marked with <span className="text-red-500 font-semibold">*</span> are required.
              </p>
              <button
                className="btn-secondary w-full justify-center"
                onClick={downloadTemplate}
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                Download Template (.xlsx)
              </button>
            </div>

            {/* Step 2 */}
            <div className="rounded-xl border border-gray-200 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Step 2 — Upload Filled Template</p>
              <p className="text-sm text-gray-600">Select the filled template to pre-fill the vendor form.</p>
              <button
                className="btn-secondary w-full justify-center"
                onClick={() => importFileRef.current?.click()}
              >
                <ArrowUpTrayIcon className="h-4 w-4" />
                Choose File (.xlsx / .xls)
              </button>
              <input
                ref={importFileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImportExcel}
              />
            </div>

            {/* Validation errors */}
            {importErrors.length > 0 && (
              <div className="rounded-xl bg-red-50 ring-1 ring-red-200 px-4 py-3 space-y-1">
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">Please fix the following errors:</p>
                <ul className="space-y-0.5">
                  {importErrors.map((err, i) => (
                    <li key={i} className="text-xs text-red-700 flex items-start gap-1.5">
                      <span className="mt-0.5 flex-shrink-0">•</span>
                      {err}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
