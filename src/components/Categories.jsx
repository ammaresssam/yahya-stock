import { useLang } from '../lib/i18n'
import { useData } from '../lib/store'
import GarmentArt from './GarmentArt'
import SectionHeading from './SectionHeading'
import { ArrowIcon } from './Icons'

export default function Categories({ onPick }) {
  const { t, pick, num } = useLang()
  const { categories, products } = useData()
  const newCount = products.filter((p) => p.isNew).length

  const go = (id) => {
    onPick(id)
    document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className="bg-paper py-16 sm:py-20" aria-labelledby="cat-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading id="cat-title" kicker={t('catKicker')} title={t('catTitle')} />
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,270px),1fr))]">
          {categories.map((c, i) => {
            const count = products.filter((p) => p.category === c.id).length
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => go(c.id)}
                className="cat-card reveal group relative flex overflow-hidden rounded-[28px] bg-white text-start ring-1 ring-line"
                data-reveal
                style={{ '--d': `${i * 80}ms` }}
              >
                <GarmentArt {...c.art} className="cat-art aspect-square w-[46%] shrink-0 p-4" />
                <span className="flex flex-1 flex-col justify-between p-5 sm:p-6">
                  <span>
                    <span className="block text-3xl font-black text-ink sm:text-4xl">{pick(c.name)}</span>
                    <span className="mt-1 block text-muted">{t('itemsCount')(num(count))}</span>
                  </span>
                  <span className="inline-flex items-center gap-2 font-bold text-brand">
                    {t('shopNow')}
                    <ArrowIcon className="size-5 transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1" />
                  </span>
                </span>
              </button>
            )
          })}
          <a
            href="#new"
            className="cat-card reveal group relative flex min-h-48 flex-col justify-between overflow-hidden rounded-[28px] bg-ink p-6 text-white "
            data-reveal
            style={{ '--d': '160ms' }}
          >
            <span className="pointer-events-none absolute inset-0 dots opacity-10" aria-hidden="true" />
            <span className="relative">
              <span className="inline-block rounded-full bg-brand px-3 py-1 text-sm font-bold">{t('newBadge')}</span>
              <span className="mt-4 block text-3xl font-black sm:text-4xl">{t('catNew')}</span>
              <span className="mt-1 block text-white/65">{t('itemsCount')(num(newCount))}</span>
            </span>
            <span className="relative inline-flex items-center gap-2 font-bold">
              {t('shopNow')}
              <ArrowIcon className="size-5 transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1" />
            </span>
          </a>
        </div>
      </div>
    </section>
  )
}
