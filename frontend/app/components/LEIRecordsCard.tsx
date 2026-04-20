'use client'

import { getApiBaseUrl } from '../lib/api-base'
import { useCachedLeiCount } from '../lib/useCachedLeiCount'
import ReferenceRecordsCard from './ReferenceRecordsCard'

export default function LEIRecordsCard() {
  const { count: totalRecords, loading } = useCachedLeiCount(getApiBaseUrl(), { pollMs: 30000 })

  return (
    <ReferenceRecordsCard
      href="/lei-records"
      title="LEI Records"
      description="Browse ISO 17442 GLEIF Legal Entity Identifiers"
      badges={['ISO 17442', 'Public']}
      icon="🏛️"
      totalRecords={totalRecords}
      loading={loading}
    />
  )
}
