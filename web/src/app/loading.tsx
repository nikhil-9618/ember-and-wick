export default function Loading() {
  return (
    <div className="shell py-16" aria-busy="true" aria-live="polite">
      <div className="h-4 w-24 animate-pulse bg-sand" />
      <div className="mt-4 h-9 w-72 animate-pulse bg-sand" />
      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index}>
            <div className="aspect-4/3 animate-pulse bg-sand" />
            <div className="mt-4 h-3 w-20 animate-pulse bg-sand" />
            <div className="mt-2 h-4 w-40 animate-pulse bg-sand" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
