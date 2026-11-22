import { useLang } from '../lib/i18n'
import ProductCard from './ProductCard'

// Featured collection: a product grid with a title and a "View all" button,
// like a Shopify theme's section. (Kept the old name so imports don't change.)
export default function Rail({ id, title, text, products, onViewAll, limit = 8, tone = 'light' }) {
  const { t } = useLang()
  if (!products.length) return null
  const list = products.slice(0, limit)
  const grey = tone === 'grey'

  return (
    <section id={id} className={`scroll-mt-24 py-12 sm:py-16 ${grey ? 'bg-paper' : 'bg-white'}`} aria-labelledby={`${id}-title`}>
      <div className="page-width">
        <div className="mb-6 sm:mb-8">
          <h2 id={`${id}-title`} className="section-title">{title}</h2>
          {text && <p className="mt-2 max-w-2xl text-muted">{text}</p>}
        </div>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">
          {list.map((p) => (
            <li key={p.id} className="flex">
              <ProductCard product={p} className="w-full" />
            </li>
          ))}
        </ul>
        {onViewAll && (
          <div className="mt-10 text-center">
            <button type="button" onClick={onViewAll} className="btn btn-ink h-12 min-w-48 px-8">{t('viewAll')}</button>
          </div>
        )}
      </div>
    </section>
  )
}
