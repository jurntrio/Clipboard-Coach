export default function MatchViewerLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl animate-pulse px-4 py-8 sm:px-8" role="status" aria-live="polite" aria-label="Wedstrijd laden">
      <div className="h-4 w-32 rounded bg-cardAlt" />
      <div className="mt-4 h-9 w-72 max-w-full rounded bg-cardAlt" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <div className="aspect-video rounded-2xl border border-border bg-card" />
          <div className="h-14 rounded-xl bg-cardAlt" />
          <div className="h-24 rounded-xl bg-cardAlt" />
        </div>
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="h-6 w-40 rounded bg-cardAlt" />
          {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-12 rounded-xl bg-cardAlt" />)}
        </div>
      </div>
      <span className="sr-only">De wedstrijd wordt geladen.</span>
    </div>
  );
}
