import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'

export async function sitemapRoutes(fastify: FastifyInstance) {
  // Dynamic sitemap.xml for each store
  fastify.get('/sitemap/:subdomain.xml', async (req: any, reply) => {
    const { subdomain } = req.params as any

    const store = await prisma.store.findUnique({
      where: { subdomain },
      include: {
        products: {
          where: { isActive: true },
          select: { slug: true, updatedAt: true },
        },
        categories: {
          where: { isActive: true },
          select: { slug: true, updatedAt: true },
        },
        blogPosts: {
          where: { isPublished: true },
          select: { slug: true, updatedAt: true },
        },
        pages: {
          where: { isActive: true },
          select: { slug: true, updatedAt: true },
        },
      },
    })

    if (!store) return reply.code(404).send('Store not found')

    const baseUrl = store.domain
      ? `https://${store.domain}`
      : `https://${subdomain}.bahrainstore.com`

    const fmt = (d: Date) => d.toISOString().split('T')[0]

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/products</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`

    for (const p of store.products) {
      xml += `
  <url>
    <loc>${baseUrl}/products/${p.slug}</loc>
    <lastmod>${fmt(p.updatedAt)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
    }

    for (const c of store.categories) {
      xml += `
  <url>
    <loc>${baseUrl}/categories/${c.slug}</loc>
    <lastmod>${fmt(c.updatedAt)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`
    }

    for (const b of store.blogPosts) {
      xml += `
  <url>
    <loc>${baseUrl}/blog/${b.slug}</loc>
    <lastmod>${fmt(b.updatedAt)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`
    }

    for (const pg of store.pages) {
      xml += `
  <url>
    <loc>${baseUrl}/pages/${pg.slug}</loc>
    <lastmod>${fmt(pg.updatedAt)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`
    }

    xml += `\n</urlset>`

    reply.header('Content-Type', 'application/xml')
    return reply.send(xml)
  })

  // Dynamic robots.txt for each store
  fastify.get('/robots/:subdomain', async (req: any, reply) => {
    const { subdomain } = req.params as any

    const store = await prisma.store.findUnique({
      where: { subdomain },
      select: { isActive: true, domain: true },
    })

    const baseUrl = store?.domain
      ? `https://${store.domain}`
      : `https://${subdomain}.bahrainstore.com`

    const robots = store?.isActive
      ? `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml
`
      : `User-agent: *
Disallow: /
`

    reply.header('Content-Type', 'text/plain')
    return reply.send(robots)
  })
}
