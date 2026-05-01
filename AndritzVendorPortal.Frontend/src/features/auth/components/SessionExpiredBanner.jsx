export default function SessionExpiredBanner({ onDone }) {
  return (
    <div className="fixed inset-x-0 top-0 z-[200] flex items-center justify-between px-6 py-3 bg-red-600 text-white text-sm font-medium shadow-lg">
      <span>Your session has expired. Please sign in again to continue.</span>
      <button
        onClick={onDone}
        className="ml-4 px-3 py-1 rounded bg-white text-red-600 font-semibold hover:bg-red-50 transition-colors"
      >
        Sign In
      </button>
    </div>
  )
}
