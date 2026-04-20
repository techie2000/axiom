'use client'

import ReferenceRecordsCard from './ReferenceRecordsCard'
import { useCollectionCount } from '../lib/useCollectionCount'

export default function CurrenciesRecordsCard() {
  const { count, loading } = useCollectionCount('/api/v1/currencies')

  return (
    <ReferenceRecordsCard
      href="/currencies"
      title="Currencies"
      description="Browse ISO 4217 currency codes and symbols"
      badges={['ISO 4217', 'Public']}
      icon="💱"
      totalRecords={count}
      loading={loading}
    />
  )
}
