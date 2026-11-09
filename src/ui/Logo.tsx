/** Museum Builder mark: an L-shaped floor plan with three exhibit rooms and a yellow entrance path. Decorative. */
export default function Logo({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <rect width="48" height="48" rx="12" fill="#f5e6c4" />
      <path d="M10 10h28v12h-8v16H10z" fill="none" stroke="#3b2f24" strokeWidth="3" strokeLinejoin="round" />
      <rect x="14" y="14" width="8" height="8" rx="1" fill="#2f6f85" />
      <rect x="14" y="26" width="8" height="8" rx="1" fill="#d98f94" />
      <rect x="26" y="26" width="8" height="8" rx="1" fill="#2f6f85" />
      <path d="M38 36v8" stroke="#f2c230" strokeWidth="5" />
    </svg>
  )
}
