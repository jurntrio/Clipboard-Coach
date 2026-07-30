export default function DashboardLoading() {
  return (
    <div
      className="mx-auto w-full max-w-7xl animate-pulse px-4 py-8 sm:px-8"
      role="status"
      aria-live="polite"
      aria-label="Pagina laden"
    >
      <div className="h-4 w-32 rounded bg-cardAlt" />
      <div className="mt-4 h-9 w-72 max-w-full rounded bg-cardAlt" />
      <div className="mt-3 h-4 w-96 max-w-full rounded bg-cardAlt" />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="rounded-2xl border border-border bg-card p-5">
            <div className="h-5 w-2/3 rounded bg-cardAlt" />
            <div className="mt-4 h-4 w-1/2 rounded bg-cardAlt" />
            <div className="mt-2 h-4 w-3/4 rounded bg-cardAlt" />
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-5">
        <div className="h-6 w-44 rounded bg-cardAlt" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-14 rounded-xl bg-cardAlt" />
          ))}
        </div>
      </div>
      <span className="sr-only">De pagina wordt geladen.</span>
    </div>
  );
}
