import { useEffect, useRef, useState } from 'react'
import { useLang } from '../lib/i18n'
import { ArrowIcon, CloseIcon } from './Icons'

// Full-screen photo viewer: swipe on phones (scroll-snap), arrows and keyboard elsewhere.
export default function Gallery({ images, name, start = 0, onClose }) {
  const { t, num } = useLang()
  const [index, setIndex] = useState(start)
  const track = useRef(null)
  const closeBtn = useRef(null)

  const go = (i) => {
    const next = (i + images.length) % images.length
    const el = track.current?.children[next]
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    setIndex(next)
  }

  useEffect(() => {
    const prevFocus = document.activeElement
    document.body.style.overflow = 'hidden'
    closeBtn.current?.focus()
    track.current?.children[start]?.scrollIntoView({ inline: 'center', block: 'nearest' })
    return () => {
      document.body.style.overflow = ''
      prevFocus?.focus?.()
    }
  }, [start])

  useEffect(() => {
    const rtl = document.documentElement.dir === 'rtl'
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') go(index + (rtl ? -1 : 1))
      if (e.key === 'ArrowLeft') go(index + (rtl ? 1 : -1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // keep the counter in sync when the user swipes
  const onScroll = () => {
    const el = track.current
    if (!el) return
    const i = Math.round(Math.abs(el.scrollLeft) / el.clientWidth)
    if (i !== index && i < images.length) setIndex(i)
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-ink/95 text-white" role="dialog" aria-modal="true" aria-label={name}>
      <div className="flex items-center justify-between px-4 py-3">
        <p className="font-bold" aria-live="polite">{t('photoOf')(num(index + 1), num(images.length))}</p>
        <button ref={closeBtn} type="button" onClick={onClose} aria-label={t('closePhotos')} className="grid size-11 place-items-center rounded-full hover:bg-white/10">
          <CloseIcon className="size-6" />
        </button>
      </div>

      <div ref={track} onScroll={onScroll} className="no-scrollbar flex flex-1 snap-x snap-mandatory overflow-x-auto">
        {images.map((src, i) => (
          <div key={src + i} className="grid w-full shrink-0 snap-center place-items-center p-4">
            <img src={src} alt={`${name} — ${t('photoOf')(num(i + 1), num(images.length))}`} className="max-h-full max-w-full rounded-2xl object-contain" />
          </div>
        ))}
      </div>

      {images.length > 1 && (
        <div className="flex items-center justify-center gap-4 p-4">
          <button type="button" onClick={() => go(index - 1)} aria-label={t('prevPhoto')} className="grid size-11 place-items-center rounded-full bg-white/10 hover:bg-white/20">
            <ArrowIcon className="size-5 -scale-x-100 rtl:scale-x-100" />
          </button>
          <div className="flex gap-1.5" aria-hidden="true">
            {images.map((_, i) => <span key={i} className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-brand' : 'w-2 bg-white/40'}`} />)}
          </div>
          <button type="button" onClick={() => go(index + 1)} aria-label={t('nextPhoto')} className="grid size-11 place-items-center rounded-full bg-white/10 hover:bg-white/20">
            <ArrowIcon className="size-5 rtl:-scale-x-100" />
          </button>
        </div>
      )}
    </div>
  )
}
