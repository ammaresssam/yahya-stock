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
    <section id={id} className={`scroll-mt-24 py-12 sm:py-16 ${grey ? 'border-y border-line bg-paper' : ''}`} aria-labelledby={`${id}-title`}>
      <div className="page-width">
        <div className="mb-8 text-center sm:mb-12">
          <h2 id={`${id}-title`} className="section-title">{title}</h2>
          {text && <p className="mx-auto mt-3 max-w-2xl text-muted">{text}</p>}
        </div>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-8 md:grid-cols-3 lg:grid-cols-4">
          {list.map((p) => (
            <li key={p.id} className="flex">
              <ProductCard product={p} className="w-full" />
            </li>
          ))}
        </ul>
        {onViewAll && (
          <div className="mt-10 text-center">
            <button type="button" onClick={onViewAll} className="btn btn-ink h-12 min-w-52 px-8">{t('viewAllProducts')}</button>
          </div>
        )}
      </div>
    </section>
  )
}
