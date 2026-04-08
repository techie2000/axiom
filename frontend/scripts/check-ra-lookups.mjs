import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const raConfigPath = path.resolve(__dirname, '../public/data/ra-urls.json')

const DEFAULT_TIMEOUT_MS = 15000
const ACCEPTED_GENERIC_STATUSES = new Set([200, 301, 302, 303, 307, 308, 403, 404, 429])

function withRegistrationNumber(templateUrl, registrationNumber) {
  return templateUrl.replaceAll('{registration_number}', encodeURIComponent(registrationNumber))
}

async function fetchWithTimeout(url, init = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'user-agent': 'axiom-ra-lookup-weekly-check/1.0',
        ...(init.headers ?? {}),
      },
    })
  } finally {
    clearTimeout(timeout)
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function loadConfig() {
  const raw = await readFile(raConfigPath, 'utf8')
  const parsed = JSON.parse(raw)

  assert(parsed && typeof parsed === 'object', 'ra-urls.json is not a JSON object')

  const entries = Object.entries(parsed)
    .filter(([key]) => key !== '_comment')
    .map(([raCode, value]) => ({ raCode, options: value }))

  for (const entry of entries) {
    assert(/^RA\d{6}$/.test(entry.raCode), `Invalid RA code key: ${entry.raCode}`)
    assert(Array.isArray(entry.options), `Expected array value for ${entry.raCode}`)
    assert(entry.options.length > 0, `Expected at least one lookup option for ${entry.raCode}`)

    for (const option of entry.options) {
      assert(option && typeof option === 'object', `Invalid lookup option object in ${entry.raCode}`)
      assert(typeof option.name === 'string' && option.name.trim().length > 0, `Missing option.name for ${entry.raCode}`)
      assert(typeof option.url === 'string' && option.url.startsWith('https://'), `Invalid option.url for ${entry.raCode}`)
      assert(
        option.url.includes('{registration_number}'),
        `Template missing {registration_number} placeholder for ${entry.raCode}: ${option.url}`
      )
    }
  }

  return entries
}

async function checkGenericGetTemplate(raCode, option, registrationNumber) {
  const resolved = withRegistrationNumber(option.url, registrationNumber)
  const response = await fetchWithTimeout(resolved, { method: 'GET', redirect: 'follow' })
  assert(
    ACCEPTED_GENERIC_STATUSES.has(response.status),
    `${raCode} (${option.name}) returned unexpected status ${response.status} for ${resolved}`
  )
}

async function run() {
  const entries = await loadConfig()
  const failures = []
  const warnings = []

  const allOptions = entries.flatMap(entry =>
    entry.options.map(option => ({ raCode: entry.raCode, option }))
  )

  console.log(`Loaded ${entries.length} RA entries with ${allOptions.length} lookup templates`)

  for (const { raCode, option } of allOptions) {
    const lowerUrl = option.url.toLowerCase()

    try {
      if (lowerUrl.includes('search.sunbiz.org/inquiry/corporationsearch/bydocumentnumber')) {
        const response = await fetchWithTimeout(
          'https://search.sunbiz.org/Inquiry/CorporationSearch/ByDocumentNumber',
          {
            method: 'POST',
            headers: {
              'content-type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              SearchTerm: 'L24000116074',
              InquiryType: 'DocumentNumber',
              SearchNameOrder: '',
            }),
            redirect: 'follow',
          }
        )

        // Sunbiz frequently returns bot-protection responses to automation.
        if (response.status === 403 || response.status === 429) {
          warnings.push(`${raCode} ${option.name}: Sunbiz returned ${response.status} (likely bot protection)`)
          console.warn(`WARN ${raCode} ${option.name}: Sunbiz returned ${response.status}`)
          continue
        }

        assert(response.status >= 200 && response.status < 400, `Sunbiz POST returned status ${response.status}`)
        const body = await response.text()
        assert(
          body.includes('CorporationSearch') || body.includes('DocumentNumber') || body.includes('Detail'),
          'Sunbiz response body does not match expected search/detail content'
        )
        console.log(`PASS ${raCode} ${option.name} (Sunbiz POST)`)
        continue
      }

      if (lowerUrl.includes('comptroller.texas.gov/data-search/franchise-tax')) {
        const response = await fetchWithTimeout(
          'https://comptroller.texas.gov/data-search/franchise-tax?fileNumber=0702886022',
          { method: 'GET', redirect: 'follow' }
        )

        assert(response.status >= 200 && response.status < 400, `Texas API returned status ${response.status}`)
        const body = await response.json()
        const hasTaxpayerId = Array.isArray(body?.data) && body.data.some(item => typeof item?.taxpayerId === 'string')
        assert(hasTaxpayerId, 'Texas API response missing taxpayerId data')
        console.log(`PASS ${raCode} ${option.name} (Texas API)`)
        continue
      }

      if (lowerUrl.includes('find-and-update.company-information.service.gov.uk/company/')) {
        await checkGenericGetTemplate(raCode, option, '00002065')
        console.log(`PASS ${raCode} ${option.name} (Companies House)`)
        continue
      }

      if (lowerUrl.includes('opencorporates.com/companies/')) {
        try {
          await checkGenericGetTemplate(raCode, option, '0000000000')
          console.log(`PASS ${raCode} ${option.name} (OpenCorporates)`)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          warnings.push(`${raCode} ${option.name}: ${message}`)
          console.warn(`WARN ${raCode} ${option.name}: ${message}`)
        }
        continue
      }

      await checkGenericGetTemplate(raCode, option, '0000000000')
      console.log(`PASS ${raCode} ${option.name} (Generic)`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(`${raCode} ${option.name}: ${message}`)
      console.error(`FAIL ${raCode} ${option.name}: ${message}`)
    }
  }

  if (failures.length > 0) {
    console.error('')
    console.error(`RA weekly lookup check failed with ${failures.length} error(s):`)
    for (const failure of failures) {
      console.error(`- ${failure}`)
    }
    process.exit(1)
  }

  if (warnings.length > 0) {
    console.log('')
    console.log(`RA weekly lookup check completed with ${warnings.length} warning(s):`)
    for (const warning of warnings) {
      console.log(`- ${warning}`)
    }
  }

  console.log('')
  console.log('RA weekly lookup check passed.')
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Fatal error: ${message}`)
  process.exit(1)
})
