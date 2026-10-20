// Wordmark and badge recreated from the shop sign:
// red "y h y", white "a a", a red hanger badge in the first "a", and "stock" underneath.

export function BrandMark({ className = 'size-10', ring = '#2b2a2f', fg = '#ffffff' }) {
  // Round badge: dark circle, white tee, hanger hook — the icon from the middle of the sign
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="34" r="28" fill={ring} />
      <path d="M32 6c4 0 6.5 2.6 6.5 5.6 0 3.2-3.3 4.4-5 5.6-.9.6-1.5 1.4-1.5 2.8" fill="none" stroke={fg} strokeWidth="3" strokeLinecap="round" />
      <path d="M32 20 16 27l-6 9 7 4 3-3v18h24V37l3 3 7-4-6-9-16-7Z" fill={fg} />
      <path d="M26 23c1.5 3 3.5 4.5 6 4.5s4.5-1.5 6-4.5" fill="none" stroke={ring} strokeWidth="2" />
    </svg>
  )
}

export function Wordmark({ className = 'h-11 w-auto', tone = 'dark', title = 'Yahya Stock' }) {
  // tone="dark"  → for dark backgrounds (white letters, like the sign)
  // tone="light" → for light backgrounds (charcoal letters)
  const soft = tone === 'dark' ? '#ffffff' : '#2b2a2f'
  const red = '#e3262d'
  const letters = [
    ['y', 26, red],
    ['a', 76, soft],
    ['h', 128, red],
    ['y', 180, red],
    ['a', 230, soft],
  ]
  return (
    <svg viewBox="0 0 258 112" className={className} role="img" aria-label={title} style={{ fontFamily: 'Nunito, system-ui, sans-serif' }}>
      <title>{title}</title>
      {letters.map(([ch, x, fill], i) => (
        <text key={i} x={x} y="74" textAnchor="middle" fontSize="88" fontWeight="900" fill={fill}>
          {ch}
        </text>
      ))}
      {/* hanger badge inside the first "a" */}
      <g transform="translate(78 54)">
        <circle r="13.5" fill={red} />
        <path d="M0-30c3.4 0 5.4 2.2 5.4 4.6 0 2.7-2.8 3.6-4.2 4.6-.8.5-1.2 1.2-1.2 2.3v4" fill="none" stroke={red} strokeWidth="3.4" strokeLinecap="round" />
        <path d="M0-6.5-7-3.3-9.5 1l3.3 1.8 1.4-1.3V8h9.6V1.5L6.2 2.8 9.5 1 7-3.3Z" fill="#fff" />
      </g>
      <text x="132" y="106" textAnchor="middle" fontSize="35" fontWeight="800" letterSpacing="5" fill={soft} fontStyle="italic">
        stock
      </text>
    </svg>
  )
}
