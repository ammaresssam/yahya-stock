import { useMemo } from 'react'
import { useLang } from '../lib/i18n'
import { useData } from '../lib/store'
import { useCatalog } from '../lib/catalogState'
import { isOnSale, maxDiscount } from '../lib/catalog'
import Rail from './Rail'

export default function NewArrivals() {
  const { t } = useLang()
  const { products } = useData()
  const list = products.filter((p) => p.isNew && p.totalStock > 0)
  return <Rail id="new" kicker={t('newKicker')} title={t('newTitle')} text={t('newText')} products={list} tone="dark" />
}

// Only products with a real "before discount" price on a size that's in stock.
export function Offers() {
  const { t } = useLang()
  const { products } = useData()
  const { browse } = useCatalog()
  const list = useMemo(() => products.filter(isOnSale).sort((a, b) => maxDiscount(b) - maxDiscount(a)).slice(0, 12), [products])
  return (
    <Rail
      id="offers"
      kicker={t('offersKicker')}
      title={t('offersTitle')}
      text={t('offersText')}
      products={list}
      onViewAll={() => browse({ onSale: true, sort: 'discount' })}
    />
  )
}
