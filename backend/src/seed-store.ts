/**
 * Quick seed: Creates a default store for the admin merchant if none exists.
 * Run: npx tsx src/seed-store.ts
 */
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
dotenv.config()

const prisma = new PrismaClient()

async function main() {
  const admin = await prisma.merchant.findUnique({ where: { email: 'admin@bazar.bh' } })
  if (!admin) {
    console.error('Admin merchant not found. Run the main seed first.')
    process.exit(1)
  }

  const existing = await prisma.store.findFirst({ where: { merchantId: admin.id } })
  if (existing) {
    console.log(`Admin already has a store: "${existing.name}" (id: ${existing.id})`)
    return
  }

  const store = await prisma.store.create({
    data: {
      merchantId: admin.id,
      name: 'Bazar Demo Store',
      nameAr: 'متجر بازار التجريبي',
      subdomain: 'demo',
      slug: 'demo',
      description: 'Default demo store for the platform admin',
      descriptionAr: 'المتجر التجريبي الافتراضي',
      settings: { create: {} },
    },
  })

  console.log(`✅ Created store "${store.name}" (id: ${store.id}) for admin`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
