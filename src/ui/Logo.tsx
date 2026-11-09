/** Museum Builder mark: a small museum front (pediment, columns) with a yellow tactile path leading to the door. Decorative. */
export default function Logo({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <rect width="48" height="48" rx="12" fill="#2f6f85" />
      <path d="M9 20 24 8l15 12z" fill="#f5e6c4" />
      <rect x="11" y="21" width="26" height="3" rx="1" fill="#d98f94" />
      {[13, 22, 31].map((x) => <rect key={x} x={x} y="25" width="4" height="11" rx="1" fill="#f5e6c4" />)}
      <rect x="9" y="36" width="30" height="3" rx="1" fill="#d98f94" />
      <rect x="20" y="39.5" width="8" height="6" rx="1" fill="#f2c230" />
      {[41.5, 43.5].map((y) => <rect key={y} x="21" y={y} width="6" height="1" fill="#b8860b" />)}
    </svg>
  )
}
