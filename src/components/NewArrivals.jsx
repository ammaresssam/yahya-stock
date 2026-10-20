import { useLang } from '../lib/i18n'
import { useData } from '../lib/store'
import ProductCard from './ProductCard'
import SectionHeading from './SectionHeading'

export default function NewArrivals() {
  const { t } = useLang()
  const { products } = useData()
  const list = products.filter((p) => p.isNew)
  if (!list.length) return null

  return (
    <section id="new" className="relative scroll-mt-28 overflow-hidden bg-ink py-16 text-white sm:py-20" aria-labelledby="new-title">
      <div className="pointer-events-none absolute inset-0 dots opacity-[.06]" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading id="new-title" tone="dark" kicker={t('newKicker')} title={t('newTitle')} text={t('newText')} />
        {/* horizontal snap rail on phones, grid on large screens */}
        <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-5 lg:overflow-visible lg:px-0">
          {list.map((p) => (
            <ProductCard key={p.id} product={p} className="w-[72%] shrink-0 snap-start sm:w-[44%] lg:w-auto" />
          ))}
        </div>
      </div>
    </section>
  )
}
