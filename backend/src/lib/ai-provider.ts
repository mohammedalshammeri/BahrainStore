import https from 'node:https'

export const AI_MODEL = 'gpt-4o'
const OPENAI_KEY = process.env.OPENAI_API_KEY || ''
const AI_DEGRADED_WINDOW_MS = 15 * 60 * 1000

export type CapabilityState = 'enabled' | 'degraded' | 'unavailable'

let aiLastFailureAt: Date | null = null
let aiLastFailureReason: string | null = null

function markAISuccess() {
  aiLastFailureAt = null
  aiLastFailureReason = null
}

function markAIFailure(reason: string) {
  aiLastFailureAt = new Date()
  aiLastFailureReason = reason.slice(0, 500)
}

export function isAIConfigured() {
  return Boolean(OPENAI_KEY)
}

export function getAICapabilityState(): CapabilityState {
  if (!OPENAI_KEY) return 'unavailable'
  if (aiLastFailureAt && Date.now() - aiLastFailureAt.getTime() <= AI_DEGRADED_WINDOW_MS) {
    return 'degraded'
  }
  return 'enabled'
}

export function createCapabilityDescriptor(label: string, enabledByProvider = true) {
  if (!enabledByProvider) {
    return {
      label,
      status: 'enabled' as CapabilityState,
      reason: 'هذه الميزة تعمل محلياً بالقواعد الحالية ولا تعتمد على OpenAI.',
    }
  }

  const status = getAICapabilityState()
  const unavailableReason = !OPENAI_KEY ? 'لم يتم ضبط مفتاح OpenAI في البيئة الحالية.' : undefined
  const degradedReason = status === 'degraded' ? aiLastFailureReason || 'تعذر الوصول إلى مزود الذكاء الاصطناعي مؤقتاً.' : undefined
  return {
    label,
    status,
    reason: unavailableReason || degradedReason,
  }
}

export function buildAICapabilities(extraFeatures?: Record<string, { label: string; enabledByProvider?: boolean }>) {
  const overallStatus = getAICapabilityState()
  const unavailableReason = !OPENAI_KEY ? 'لم يتم ضبط مفتاح OpenAI في البيئة الحالية.' : undefined
  const degradedReason = overallStatus === 'degraded' ? aiLastFailureReason || 'تعذر الوصول إلى مزود الذكاء الاصطناعي مؤقتاً.' : undefined
  const reason = unavailableReason || degradedReason

  const features = {
    copilot: createCapabilityDescriptor('Bazar Copilot'),
    productWriter: createCapabilityDescriptor('كاتب المنتجات'),
    storeAnalysis: createCapabilityDescriptor('تحليل المتجر'),
    priceSuggestion: createCapabilityDescriptor('اقتراح التسعير'),
    fraudDetection: createCapabilityDescriptor('كشف الاحتيال', false),
    ...(extraFeatures
      ? Object.fromEntries(
          Object.entries(extraFeatures).map(([key, feature]) => [key, createCapabilityDescriptor(feature.label, feature.enabledByProvider !== false)])
        )
      : {}),
  }

  return {
    provider: 'openai',
    model: AI_MODEL,
    overallStatus,
    reason,
    lastFailureAt: aiLastFailureAt?.toISOString() || null,
    features,
  }
}

export async function callOpenAI(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  model = AI_MODEL,
  maxTokens = 1000,
): Promise<string> {
  if (!OPENAI_KEY) {
    throw new Error('AI_NOT_READY')
  }

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.2 })
    const req = https.request(
      {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_KEY}`,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let raw = ''
        res.on('data', (chunk) => (raw += chunk))
        res.on('end', () => {
          try {
            const data = JSON.parse(raw)
            if (data.error) {
              markAIFailure(data.error.message || 'OpenAI provider error')
              reject(new Error(data.error.message))
              return
            }

            markAISuccess()
            resolve(data.choices?.[0]?.message?.content || '')
          } catch {
            markAIFailure('Invalid OpenAI response')
            reject(new Error('Invalid OpenAI response'))
          }
        })
      },
    )

    req.on('error', (error) => {
      markAIFailure(error.message)
      reject(error)
    })

    req.write(body)
    req.end()
  })
}

export function aiErrorReply(reply: any, error: any, fallbackMessage: string, extraFeatures?: Record<string, { label: string; enabledByProvider?: boolean }>) {
  if (error?.message === 'AI_NOT_READY') {
    return reply.status(503).send({
      error: 'خدمات AI غير مهيأة في البيئة الحالية',
      status: 'NOT_READY',
      capability: buildAICapabilities(extraFeatures),
    })
  }

  markAIFailure(error?.message || fallbackMessage)
  return reply.status(502).send({
    error: fallbackMessage,
    details: error?.message,
    status: 'DEGRADED',
    capability: buildAICapabilities(extraFeatures),
  })
}
