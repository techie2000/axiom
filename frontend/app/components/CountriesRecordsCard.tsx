'use client'

import ReferenceRecordsCard from './ReferenceRecordsCard'
import { useCollectionCount } from '../lib/useCollectionCount'

export default function CountriesRecordsCard() {
  const { count, loading } = useCollectionCount('/api/v1/countries')

  return (
    <ReferenceRecordsCard
      href="/countries"
      title="Countries"
      description="Browse ISO 3166 country codes and reference data"
      badges={['ISO 3166', 'Public']}
      icon="🗺️"
      totalRecords={count}
      loading={loading}
    />
  )
}
