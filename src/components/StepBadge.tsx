/** A small numbered circle used to mark the steps of the workflow. */
export function StepBadge({ n, className }: { n: number; className?: string }) {
  return (
    <span
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
        className ?? 'bg-blue-600 text-white'
      }`}
    >
      {n}
    </span>
  )
}
