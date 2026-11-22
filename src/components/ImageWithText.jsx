import { useLang } from '../lib/i18n'
import { useData } from '../lib/store'
import { waLink } from '../lib/links'
import { BrandMark } from './Brand'
import { WhatsAppIcon } from './Icons'

// "Image with text" section about the shop. The picture is the shop-sign badge
// until the owner adds real photos (then the second product photo is used).
export default function ImageWithText() {
  const { t, pick } = useLang()
  const { products } = useData()
  const photos = products.filter((p) => p.image)
  const photo = photos[1] ?? photos[0]

  return (
    <section id="about" className="scroll-mt-24 py-12 sm:py-16" aria-labelledby="about-title">
      <div className="page-width grid items-center gap-8 md:grid-cols-2 lg:gap-16">
        <div className="relative overflow-hidden rounded-lg bg-ink">
          {photo ? (
            <img src={photo.image} alt={pick(photo.name)} loading="lazy" className="aspect-[5/4] w-full object-cover" />
          ) : (
            <div className="relative grid aspect-[5/4] place-items-center" aria-hidden="true">
              <div className="dots absolute inset-0 opacity-[.08]" />
              <BrandMark className="relative size-[46%]" ring="#e3262d" />
            </div>
          )}
        </div>
        <div>
          <h2 id="about-title" className="section-title">{t('aboutTitle')}</h2>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted">{t('aboutText')}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#visit" className="btn btn-ink h-12 px-7">{t('aboutCta')}</a>
            <a href={waLink()} target="_blank" rel="noopener noreferrer" className="btn btn-outline h-12 px-6">
              <WhatsAppIcon className="size-5 text-[#1fa855]" />
              {t('whatsapp')}
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
