'use client'

import ReferenceRecordsCard from './ReferenceRecordsCard'
import { useCollectionCount } from '../lib/useCollectionCount'

export default function LanguagesRecordsCard() {
  const { count, loading } = useCollectionCount('/api/v1/languages')

  return (
    <ReferenceRecordsCard
      href="/languages"
      title="Languages"
      description="Browse ISO 639 language codes, names, and writing direction"
      badges={['ISO 639', 'Public']}
      icon="🈺"
      totalRecords={count}
      loading={loading}
    />
  )
}
