const OPTIONS = [10, 15, 20, 25, 50, 100]

export default function PageSizeSelect({ value, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-400">Rows:</span>
      <select
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="text-xs text-gray-600 bg-white border border-gray-200 rounded px-1.5 py-0.5 pr-5 appearance-none cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%239ca3af'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 4px center' }}
      >
        {OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
      </select>
    </div>
  )
}
