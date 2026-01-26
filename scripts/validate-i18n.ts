import plMessages from '../messages/pl.json'
import enMessages from '../messages/en.json'

type Messages = Record<string, unknown>

function getAllKeys(obj: Messages, prefix = ''): string[] {
  const keys: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...getAllKeys(value as Messages, fullKey))
    } else {
      keys.push(fullKey)
    }
  }
  return keys
}

function findMissingKeys(source: string[], target: string[]): string[] {
  const targetSet = new Set(target)
  return source.filter((key) => !targetSet.has(key))
}

function main() {
  const plKeys = getAllKeys(plMessages as Messages)
  const enKeys = getAllKeys(enMessages as Messages)

  const missingInEn = findMissingKeys(plKeys, enKeys)
  const missingInPl = findMissingKeys(enKeys, plKeys)

  let hasErrors = false

  if (missingInEn.length > 0) {
    console.error('\n❌ Missing in English (en.json):')
    missingInEn.forEach((key) => console.error(`  - ${key}`))
    hasErrors = true
  }

  if (missingInPl.length > 0) {
    console.error('\n❌ Missing in Polish (pl.json):')
    missingInPl.forEach((key) => console.error(`  - ${key}`))
    hasErrors = true
  }

  if (hasErrors) {
    console.error('\n⚠️  Translation keys are out of sync!')
    process.exit(1)
  }

  console.log('\n✅ All translation keys are in sync!')
  console.log(`   Polish: ${plKeys.length} keys`)
  console.log(`   English: ${enKeys.length} keys`)
  process.exit(0)
}

main()
