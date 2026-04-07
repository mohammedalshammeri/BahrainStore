import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  BACKEND_URL: z.string().url('BACKEND_URL must be a valid URL').default('http://localhost:3001'),
  DASHBOARD_URL: z.string().url('DASHBOARD_URL must be a valid URL').default('http://localhost:3002'),
  STOREFRONT_URL: z.string().url('STOREFRONT_URL must be a valid URL').default('http://localhost:3000'),
  API_BASE_URL: z.string().url('API_BASE_URL must be a valid URL').optional(),
  ORDER_TRACKING_SECRET: z.string().min(32, 'ORDER_TRACKING_SECRET must be at least 32 characters').optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  SMTP_FROM: z.string().email('SMTP_FROM must be a valid email').optional(),
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_EMAIL: z.string().startsWith('mailto:', 'VAPID_EMAIL must start with mailto:').optional(),
})

function assertPaired(values: Record<string, string | number | undefined>, keys: string[], label: string) {
  const present = keys.filter((key) => {
    const value = values[key]
    return value !== undefined && value !== ''
  })

  if (present.length > 0 && present.length !== keys.length) {
    const missing = keys.filter((key) => !present.includes(key))
    throw new Error(`${label} env is incomplete. Missing: ${missing.join(', ')}`)
  }
}

function buildEnv() {
  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
    throw new Error(`Invalid backend environment:\n${issues.join('\n')}`)
  }

  const env = {
    ...parsed.data,
    API_BASE_URL: parsed.data.API_BASE_URL ?? parsed.data.BACKEND_URL,
  }

  assertPaired(env, ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'], 'Google OAuth')
  assertPaired(env, ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'], 'SMTP')
  assertPaired(env, ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'], 'VAPID')

  return env
}

let cachedEnv: ReturnType<typeof buildEnv> | null = null

export function getEnv() {
  cachedEnv ??= buildEnv()
  return cachedEnv
}

export function validateEnv() {
  return getEnv()
}

export type AppEnv = ReturnType<typeof getEnv>