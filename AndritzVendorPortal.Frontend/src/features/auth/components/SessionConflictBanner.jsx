// Shown when another tab in the same browser signs in as a different user.
// Blocks all interaction with this tab — the only way out is to reload, which
// rehydrates the store from the now-shared auth-store key.
export default function SessionConflictBanner() {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="max-w-md w-full mx-6 rounded-2xl bg-white shadow-2xl p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-2">
          Another session is active
        </h2>
        <p className="text-sm text-slate-600 mb-5">
          A different user has signed in in another tab of this browser.
          For your security, only one user can be signed in at a time.
          Reload this tab to continue.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="w-full px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          Reload
        </button>
      </div>
    </div>
  )
}
