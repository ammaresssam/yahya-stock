import { useLang } from '../lib/i18n'

// Square colour swatches. The chosen one gets a thin dark outline; a colour that is
// sold out in every size is crossed out, like the sizes.
export default function Swatches({ colors, value, onChange, size = 'lg', labelId }) {
  const { t, pick } = useLang()
  const box = size === 'lg' ? 'size-9' : 'size-5'
  return (
    <div role="radiogroup" aria-labelledby={labelId} className={`flex flex-wrap gap-2 ${size === 'lg' ? '' : 'justify-center gap-1.5'}`}>
      {colors.map((c) => {
        const name = pick(c.name)
        const out = c.stock === 0
        const on = value === c.key
        return (
          <button
            key={c.key}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={out ? `${name} — ${t('colorSoldOut')}` : name}
            title={out ? `${name} — ${t('colorSoldOut')}` : name}
            onClick={() => onChange(c.key)}
            className={`swatch ${box} ${on ? 'is-on' : ''} ${out ? 'is-out' : ''}`}
          >
            <span className="swatch-fill" style={{ background: c.hex || 'var(--color-paper)' }}>
              {!c.hex && size === 'lg' && <span className="text-[10px] text-ink">{name.slice(0, 2)}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
