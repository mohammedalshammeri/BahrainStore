import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

// ─── GraphQL API (via raw HTTP, no external GraphQL deps needed) ──────────────
// Pure Fastify with hand-crafted GraphQL execution for types/queries we need

const typeDefs = `
  type Store {
    id: ID!
    name: String!
    subdomain: String!
    customDomain: String
    logo: String
    productsCount: Int
    ordersCount: Int
    createdAt: String!
  }

  type Product {
    id: ID!
    name: String!
    nameAr: String
    slug: String!
    price: Float!
    comparePrice: Float
    stock: Int!
    images: [String]
    active: Boolean!
    createdAt: String!
  }

  type Order {
    id: ID!
    orderNumber: String!
    status: String!
    total: Float!
    itemCount: Int!
    createdAt: String!
  }

  type Customer {
    id: ID!
    name: String!
    email: String!
    phone: String
    ordersCount: Int!
    totalSpent: Float!
    createdAt: String!
  }

  type Category {
    id: ID!
    name: String!
    nameAr: String
    slug: String!
    productsCount: Int!
  }

  type PageInfo {
    total: Int!
    page: Int!
    limit: Int!
    hasNextPage: Boolean!
  }

  type ProductsResult {
    items: [Product]!
    pageInfo: PageInfo!
  }

  type OrdersResult {
    items: [Order]!
    pageInfo: PageInfo!
  }

  type CustomersResult {
    items: [Customer]!
    pageInfo: PageInfo!
  }

  type Query {
    store(id: ID!): Store
    products(storeId: ID!, page: Int, limit: Int, search: String, categoryId: ID, active: Boolean): ProductsResult!
    product(id: ID!): Product
    orders(storeId: ID!, page: Int, limit: Int, status: String): OrdersResult!
    order(id: ID!): Order
    customers(storeId: ID!, page: Int, limit: Int, search: String): CustomersResult!
    customer(id: ID!): Customer
    categories(storeId: ID!): [Category]!
  }

  type Mutation {
    updateProduct(id: ID!, price: Float, stock: Int, active: Boolean, name: String): Product
    updateOrderStatus(id: ID!, status: String!): Order
  }
`

// ─── Resolver Functions ────────────────────────────────────────────────────────

const resolvers: Record<string, Record<string, Function>> = {
  Query: {
    store: async (_: any, { id }: { id: string }) => {
      const store = await prisma.store.findUnique({
        where: { id },
        include: { _count: { select: { products: true, orders: true } } },
      })
      if (!store) return null
      return {
        ...store,
        productsCount: store._count.products,
        ordersCount: store._count.orders,
      }
    },

    products: async (_: any, args: any) => {
      const { storeId, page = 1, limit = 20, search, categoryId, active } = args
      const skip = (page - 1) * limit
      const where: any = { storeId }
      if (search) where.name = { contains: search, mode: 'insensitive' }
      if (categoryId) where.categoryId = categoryId
      if (active !== undefined) where.active = active

      const [items, total] = await Promise.all([
        prisma.product.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
        prisma.product.count({ where }),
      ])

      return {
        items,
        pageInfo: { total, page, limit, hasNextPage: skip + limit < total },
      }
    },

    product: async (_: any, { id }: { id: string }) =>
      prisma.product.findUnique({ where: { id } }),

    orders: async (_: any, args: any) => {
      const { storeId, page = 1, limit = 20, status } = args
      const skip = (page - 1) * limit
      const where: any = { storeId }
      if (status) where.status = status

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where, skip, take: limit, orderBy: { createdAt: 'desc' },
          include: { _count: { select: { items: true } } },
        }),
        prisma.order.count({ where }),
      ])

      return {
        items: orders.map(o => ({ ...o, itemCount: o._count.items })),
        pageInfo: { total, page, limit, hasNextPage: skip + limit < total },
      }
    },

    order: async (_: any, { id }: { id: string }) =>
      prisma.order.findUnique({ where: { id }, include: { items: true } }),

    customers: async (_: any, args: any) => {
      const { storeId, page = 1, limit = 20, search } = args
      const skip = (page - 1) * limit
      const where: any = { storeId }
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ]
      }

      const [customers, total] = await Promise.all([
        prisma.customer.findMany({
          where, skip, take: limit, orderBy: { createdAt: 'desc' },
          include: { _count: { select: { orders: true } } },
        }),
        prisma.customer.count({ where }),
      ])

      return {
        items: customers.map(c => ({
          ...c,
          ordersCount: c._count.orders,
          totalSpent: Number(c.totalSpent || 0),
        })),
        pageInfo: { total, page, limit, hasNextPage: skip + limit < total },
      }
    },

    customer: async (_: any, { id }: { id: string }) =>
      prisma.customer.findUnique({ where: { id } }),

    categories: async (_: any, { storeId }: { storeId: string }) => {
      const cats = await prisma.category.findMany({
        where: { storeId },
        include: { _count: { select: { products: true } } },
      })
      return cats.map(c => ({ ...c, productsCount: c._count.products }))
    },
  },

  Mutation: {
    updateProduct: async (_: any, { id, ...data }: any) => {
      const updateData: any = {}
      if (data.price !== undefined) updateData.price = data.price
      if (data.stock !== undefined) updateData.stock = data.stock
      if (data.active !== undefined) updateData.active = data.active
      if (data.name !== undefined) updateData.name = data.name
      return prisma.product.update({ where: { id }, data: updateData })
    },

    updateOrderStatus: async (_: any, { id, status }: any) => {
      return prisma.order.update({ where: { id }, data: { status } })
    },
  },
}

// ─── Minimal GraphQL Executor ────────────────────────────────────────────────

async function executeGraphQL(query: string, variables: Record<string, any> = {}): Promise<any> {
  // Simple regex-based parser for our limited schema
  // In production, use graphql-js for full spec compliance
  const errors: any[] = []
  const data: any = {}

  try {
    // Detect operation type
    const isMutation = /^\s*mutation\b/i.test(query.trim())
    const operationGroup = isMutation ? resolvers.Mutation : resolvers.Query

    // Extract field calls using regex
    const bodyMatch = query.match(/[{(][^{]*{([\s\S]+)}[^}]*$/)
    if (!bodyMatch) throw new Error('Invalid GraphQL query format')

    const body = bodyMatch[1]
    const fieldPattern = /(\w+)\s*(?:\(([^)]*)\))?\s*\{([^{}]+)\}/g
    const simplePattern = /(\w+)\s*(?:\(([^)]*)\))?(?!\s*\{)/g

    let match: RegExpExecArray | null

    // Parse field calls with sub-selections
    const processedFields = new Set<string>()

    while ((match = fieldPattern.exec(body)) !== null) {
      const [, fieldName, argsStr] = match
      processedFields.add(fieldName)

      if (!operationGroup[fieldName]) continue

      const args = parseArgs(argsStr || '', variables)
      data[fieldName] = await operationGroup[fieldName](null, args)
    }

    // Parse simple field calls
    while ((match = simplePattern.exec(body)) !== null) {
      const [, fieldName, argsStr] = match
      if (processedFields.has(fieldName)) continue
      if (!operationGroup[fieldName]) continue

      const args = parseArgs(argsStr || '', variables)
      data[fieldName] = await operationGroup[fieldName](null, args)
    }
  } catch (err: any) {
    errors.push({ message: err.message })
  }

  return { data, errors: errors.length > 0 ? errors : undefined }
}

function parseArgs(argsStr: string, variables: Record<string, any>): Record<string, any> {
  const args: Record<string, any> = {}
  if (!argsStr.trim()) return args

  const pairs = argsStr.split(',')
  for (const pair of pairs) {
    const [key, value] = pair.split(':').map(s => s.trim())
    if (!key || !value) continue

    if (value.startsWith('$')) {
      // Variable reference
      args[key] = variables[value.slice(1)]
    } else if (value === 'true') {
      args[key] = true
    } else if (value === 'false') {
      args[key] = false
    } else if (/^\d+$/.test(value)) {
      args[key] = parseInt(value)
    } else if (/^\d+\.\d+$/.test(value)) {
      args[key] = parseFloat(value)
    } else {
      // String — remove quotes
      args[key] = value.replace(/^["']|["']$/g, '')
    }
  }

  return args
}

// ─── Fastify Route Registration ───────────────────────────────────────────────

export async function graphqlRoutes(app: FastifyInstance) {
  // GET /graphql — GraphQL Playground (schema introspection info)
  app.get('/', async (_request, reply) => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Bazar GraphQL API</title>
  <style>body{font-family:sans-serif;max-width:800px;margin:40px auto;padding:20px;} pre{background:#f5f5f5;padding:16px;border-radius:8px;overflow-x:auto;}</style>
</head>
<body>
  <h1>🛍️ Bazar GraphQL API</h1>
  <p>Send POST requests to <code>/api/v1/graphql</code> with your query.</p>
  <h2>Example Query</h2>
  <pre>
POST /api/v1/graphql
Authorization: Bearer &lt;your-token&gt;
Content-Type: application/json

{
  "query": "{ products(storeId: \\"store-id\\", limit: 10) { items { id name price } pageInfo { total } } }"
}
  </pre>
  <h2>Available Queries</h2>
  <pre>${typeDefs}</pre>
</body>
</html>`
    reply.header('Content-Type', 'text/html')
    return reply.send(html)
  })

  // POST /graphql — Execute GraphQL query
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const { query, variables } = request.body as {
      query?: string
      variables?: Record<string, any>
    }

    if (!query) {
      return reply.status(400).send({ errors: [{ message: 'يجب تحديد query' }] })
    }

    // Basic query depth protection (prevent deeply nested queries)
    const depth = (query.match(/{/g) || []).length
    if (depth > 5) {
      return reply.status(400).send({ errors: [{ message: 'Query depth exceeds limit of 5' }] })
    }

    const result = await executeGraphQL(query, variables || {})
    return reply.send(result)
  })

  // GET /graphql/schema — Returns the schema as text
  app.get('/schema', async (_request, reply) => {
    reply.header('Content-Type', 'text/plain')
    return reply.send(typeDefs)
  })
}
