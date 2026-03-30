import 'dotenv/config'
import { buildServer } from './server'

const PORT = parseInt(process.env.PORT || '3001')

async function main() {
  const app = await buildServer()

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' })
    console.log(`🚀 Bazar API running on http://localhost:${PORT}`)
    console.log(`📦 Developer: BSMC.BH`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

main()
