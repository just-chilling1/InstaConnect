export default function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="border border-border bg-surface rounded-xl overflow-hidden animate-pulse"
        >
          <div className="flex items-center gap-2.5 px-4 py-3">
            <div className="w-9 h-9 rounded-full bg-surface-2" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-surface-2 rounded w-24" />
              <div className="h-2 bg-surface-2 rounded w-16" />
            </div>
          </div>
          <div className="h-64 bg-surface-2" />
          <div className="px-4 py-3 flex gap-4">
            <div className="h-4 bg-surface-2 rounded w-12" />
            <div className="h-4 bg-surface-2 rounded w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}
