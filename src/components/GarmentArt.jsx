// Lightweight vector illustrations used until real product photos are added.
// Each garment is drawn on a 200×200 canvas and hangs from a hanger, echoing the brand mark.

const shapes = {
  tee: (
    <>
      <path d="M72 46 50 54 26 78l17 20 15-10v82h84V88l15 10 17-20-24-24-22-8c-4 13-14 20-28 20s-24-7-28-20Z" />
      <path d="M72 46c4 13 14 20 28 20s24-7 28-20" className="g-line" />
    </>
  ),
  shirt: (
    <>
      <path d="M74 44 50 52 32 128l16 4 12-44v84h80V88l12 44 16-4-18-76-24-8-26 24-26-24Z" />
      <path d="m74 44 10 26 16-6 16 6 10-26" className="g-line" />
      <path d="M100 64v104" className="g-line" />
      {[82, 102, 122, 142].map((y) => <circle key={y} cx="106" cy={y} r="2.4" className="g-dot" />)}
    </>
  ),
  hoodie: (
    <>
      <path d="M70 52 48 60 30 134l17 4 13-42v76h80V96l13 42 17-4-18-74-22-8c-2-16-14-26-30-26s-28 10-30 26Z" />
      <path d="M78 54c4 12 12 18 22 18s18-6 22-18" className="g-line" />
      <path d="M92 72v20M108 72v20" className="g-line" />
      <path d="M74 134h52l-6 22H80Z" className="g-line" />
    </>
  ),
  jacket: (
    <>
      <path d="M74 44 50 52 32 132l16 4 12-46v82h80V90l12 46 16-4-18-80-24-8-26 26-26-26Z" />
      <path d="m74 44 8 30 18 -4M126 44l-8 30-18-4" className="g-line" />
      <path d="M100 70v102" className="g-line" />
      <path d="M68 128h20M112 128h20" className="g-line" />
    </>
  ),
  pants: (
    <>
      <path d="M64 40h72l10 132h-36l-10-92-10 92H54Z" />
      <path d="M64 54h72M100 54v26" className="g-line" />
      <path d="M72 54c2 12 10 18 20 18M128 54c-2 12-10 18-20 18" className="g-line" />
    </>
  ),
  dress: (
    <>
      <path d="M82 40h10l8 16 8-16h10l4 34 10 14 26 82H42l26-82 10-14Z" />
      <path d="M78 74c14 6 30 6 44 0" className="g-line" />
    </>
  ),
  skirt: (
    <>
      <path d="M70 52h60l26 116H44Z" />
      <path d="M70 66h60" className="g-line" />
      <path d="M86 66 78 168M100 66v102M114 66l8 102" className="g-line" />
    </>
  ),
}

export default function GarmentArt({ type = 'tee', color = '#2b2a2f', bg = '#eeece8', label, className = '' }) {
  const light = isLight(color)
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: bg }}>
      <div className="absolute inset-0 g-sheen" aria-hidden="true" />
      <svg
        viewBox="0 0 200 200"
        className="g-art relative mx-auto h-full w-full"
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : 'true'}
        style={{ '--g-fill': color, '--g-ink': light ? 'rgba(43,42,47,.28)' : 'rgba(255,255,255,.28)' }}
      >
        {/* hanger */}
        <path d="M100 14c6 0 9.5 3.6 9.5 7.8 0 4.5-4.5 6-7 7.8-1.5 1-2.5 2.2-2.5 4.4v4" fill="none" stroke="rgba(43,42,47,.55)" strokeWidth="3" strokeLinecap="round" />
        <path d="M100 38 62 52M100 38l38 14" fill="none" stroke="rgba(43,42,47,.55)" strokeWidth="3" strokeLinecap="round" />
        <g className="g-shape">{shapes[type] ?? shapes.tee}</g>
      </svg>
    </div>
  )
}

function isLight(hex) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 170
}
