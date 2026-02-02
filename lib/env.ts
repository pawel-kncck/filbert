import { z } from 'zod'

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  GUS_API_KEY: z.string().min(1).optional(),
  GUS_ENVIRONMENT: z.enum(['test', 'prod']).default('test'),
})

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
})

function validateEnv() {
  const isServer = typeof window === 'undefined'
  const schema = isServer ? serverSchema : clientSchema

  // Next.js only inlines individual process.env.NEXT_PUBLIC_* references at
  // compile time — passing `process.env` as a whole object doesn't work on
  // the client. Build an explicit object so each reference is replaced.
  const rawEnv = isServer
    ? process.env
    : {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
      }

  const parsed = schema.safeParse(rawEnv)

  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Missing or invalid environment variables:\n${formatted}`)
  }

  return parsed.data
}

export const env = validateEnv()
