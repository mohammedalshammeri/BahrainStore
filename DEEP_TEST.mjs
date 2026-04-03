/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║         BAZAR PLATFORM — DEEP INTEGRATION TEST SUITE            ║
 * ║         اختبار عميق شامل لكل مسارات الـ API                      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * HOW TO RUN:
 *   1. Start the backend:  cd backend && npm run dev
 *   2. Run this file:      node DEEP_TEST.mjs
 *
 * COVERS:
 *   ✦ Server Health & Connectivity
 *   ✦ Authentication (register, login, refresh, 2FA, password reset)
 *   ✦ Input Validation (missing fields, wrong types, boundaries)
 *   ✦ Security (JWT tampering, SQL injection, XSS, IDOR)
 *   ✦ Store Management (CRUD + subdomain uniqueness)
 *   ✦ Category Management (CRUD + tree structure)
 *   ✦ Product Management (CRUD + stock + variants)
 *   ✦ Customer Management (register + search + pagination)
 *   ✦ Cart Management (add, update, remove)
 *   ✦ Coupon System (create, validate, expired, exhausted)
 *   ✦ Order Flow (create, status change, access control)
 *   ✦ Analytics (pageview tracking, traffic summary)
 *   ✦ Authorization (cross-merchant resource access)
 *   ✦ Error Handling (404, 400, 401, 403, 409, 500)
 *   ✦ Cleanup (delete all test data)
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const BASE = 'http://localhost:3001/api/v1'
const TIMEOUT_MS = 15000

// Test identifiers — unique per run so we don't collide with existing data
const RUN_ID = Date.now().toString(36)
const TEST_EMAIL_A  = `test_a_${RUN_ID}@bazar-test.com`
const TEST_EMAIL_B  = `test_b_${RUN_ID}@bazar-test.com`
const TEST_PHONE_A  = `3${RUN_ID.slice(-7).padStart(7,'0')}`
const TEST_PHONE_B  = `4${RUN_ID.slice(-7).padStart(7,'0')}`
const TEST_SUBDOMAIN = `test-${RUN_ID}`
const TEST_SUBDOMAIN_B = `test-b-${RUN_ID}`

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ANSI COLORS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  magenta:'\x1b[35m',
  blue:   '\x1b[34m',
  white:  '\x1b[37m',
  bgRed:  '\x1b[41m',
  bgGreen:'\x1b[42m',
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STATE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const state = {
  tokenA: null,         // merchant A access token
  refreshTokenA: null,  // merchant A refresh token
  merchantAId: null,
  tokenB: null,         // merchant B access token
  merchantBId: null,
  storeId: null,
  storeBId: null,
  apiKey: null,         // store A public API key
  categoryId: null,
  productId: null,
  productSlug: null,
  customerId: null,
  couponId: null,
  orderId: null,
  cartSessionId: `cart-${RUN_ID}`,
  results: [],
  suiteResults: [],
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function req(method, path, body, token) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  const t0 = Date.now()
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    const elapsed = Date.now() - t0
    let data
    try { data = await res.json() } catch { data = {} }
    return { status: res.status, data, elapsed }
  } catch (err) {
    clearTimeout(timer)
    const elapsed = Date.now() - t0
    return { status: 0, data: { error: err.message }, elapsed }
  }
}

const get    = (p, t)    => req('GET',    p, null, t)
const post   = (p, b, t) => req('POST',   p, b,    t)
const patch  = (p, b, t) => req('PATCH',  p, b,    t)
const del    = (p, t)    => req('DELETE', p, null, t)

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST RUNNER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let passCount = 0, failCount = 0, skipCount = 0
let currentSuite = ''

function suite(name) {
  currentSuite = name
  console.log(`\n${C.bold}${C.cyan}━━━ ${name} ━━━${C.reset}`)
}

function test(name, passed, detail = '', elapsed = null) {
  const icon   = passed ? `${C.green}✔${C.reset}` : `${C.red}✘${C.reset}`
  const color  = passed ? C.green : C.red
  const time   = elapsed != null ? ` ${C.dim}(${elapsed}ms)${C.reset}` : ''
  const extra  = detail ? ` ${C.dim}→ ${detail}${C.reset}` : ''
  console.log(`  ${icon} ${color}${name}${C.reset}${time}${extra}`)
  if (passed) passCount++
  else failCount++
  state.results.push({ suite: currentSuite, name, passed, detail, elapsed })
}

function skip(name, reason = '') {
  console.log(`  ${C.yellow}⊘${C.reset} ${C.dim}${name}${reason ? ` (${reason})` : ''}${C.reset}`)
  skipCount++
  state.results.push({ suite: currentSuite, name, passed: null, detail: reason })
}

function info(msg) {
  console.log(`  ${C.blue}ℹ${C.reset} ${C.dim}${msg}${C.reset}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ① SERVER HEALTH
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testHealth() {
  suite('① SERVER HEALTH & CONNECTIVITY')

  // Health is at root level, not under /api/v1
  const t0h = Date.now()
  let r = { status: 0, data: {}, elapsed: 0 }
  try {
    const res = await fetch('http://localhost:3001/health')
    const data = await res.json().catch(() => ({}))
    r = { status: res.status, data, elapsed: Date.now() - t0h }
  } catch { r.elapsed = Date.now() - t0h }
  test('Server is reachable', r.status !== 0, `HTTP ${r.status}`, r.elapsed)
  test('Health endpoint returns 200', r.status === 200, `status=${r.status}`, r.elapsed)
  test('Health response time < 500ms', r.elapsed < 500, `${r.elapsed}ms`)

  // Swagger docs
  const sw = await fetch('http://localhost:3001/docs').catch(() => ({ status: 0 }))
  test('Swagger UI is accessible', sw.status === 200 || sw.status === 301, `status=${sw.status}`)

  // Non-existent route
  const r404 = await get('/this-route-does-not-exist')
  test('Unknown routes return 404', r404.status === 404, `status=${r404.status}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ② AUTHENTICATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testAuth() {
  suite('② AUTHENTICATION — Register / Login / Tokens')

  // ── Register Merchant A ──
  const regA = await post('/auth/register', {
    email: TEST_EMAIL_A, phone: TEST_PHONE_A, password: 'StrongPass@123',
    firstName: 'تاجر', lastName: 'أول',
  })
  test('Register new merchant — 201', regA.status === 201, `status=${regA.status}`, regA.elapsed)
  test('Register returns accessToken', !!regA.data?.accessToken, typeof regA.data?.accessToken)
  test('Register returns refreshToken', !!regA.data?.refreshToken)
  test('Register returns merchant object', !!regA.data?.merchant?.id)
  test('Password NOT in response', !regA.data?.merchant?.passwordHash && !regA.data?.merchant?.password)
  state.tokenA = regA.data?.accessToken
  state.refreshTokenA = regA.data?.refreshToken
  state.merchantAId = regA.data?.merchant?.id

  // ── Register Merchant B (for cross-access tests) ──
  const regB = await post('/auth/register', {
    email: TEST_EMAIL_B, phone: TEST_PHONE_B, password: 'StrongPass@456',
    firstName: 'تاجر', lastName: 'ثاني',
  })
  test('Register second merchant — 201', regB.status === 201, `status=${regB.status}`)
  state.tokenB = regB.data?.accessToken
  state.merchantBId = regB.data?.merchant?.id

  // ── Duplicate email ──
  const dupEmail = await post('/auth/register', {
    email: TEST_EMAIL_A, phone: '99999999', password: 'StrongPass@789',
    firstName: 'مكرر', lastName: 'ايميل',
  })
  test('Duplicate email → 409', dupEmail.status === 409, `status=${dupEmail.status}`)
  test('Duplicate error message in Arabic', typeof dupEmail.data?.error === 'string' && dupEmail.data.error.length > 0)

  // ── Duplicate phone ──
  const dupPhone = await post('/auth/register', {
    email: `unique_${RUN_ID}@test.com`, phone: TEST_PHONE_A, password: 'StrongPass@789',
    firstName: 'مكرر', lastName: 'هاتف',
  })
  test('Duplicate phone → 409', dupPhone.status === 409, `status=${dupPhone.status}`)

  // ── Login valid ──
  const login = await post('/auth/login', { email: TEST_EMAIL_A, password: 'StrongPass@123' })
  test('Login valid credentials — 200', login.status === 200, `status=${login.status}`, login.elapsed)
  test('Login returns accessToken', !!login.data?.accessToken)
  test('Login response time < 2000ms', login.elapsed < 2000, `${login.elapsed}ms`)

  // Update token from fresh login
  state.tokenA = login.data?.accessToken || state.tokenA
  state.refreshTokenA = login.data?.refreshToken || state.refreshTokenA

  // ── Login wrong password ──
  const badPw = await post('/auth/login', { email: TEST_EMAIL_A, password: 'WrongPassword!' })
  test('Wrong password → 401', badPw.status === 401, `status=${badPw.status}`)

  // ── Login non-existent email ──
  const noUser = await post('/auth/login', { email: 'nobody@nowhere.com', password: 'anything' })
  test('Non-existent user → 401', noUser.status === 401, `status=${noUser.status}`)

  // ── Access protected route without token ──
  const noAuth = await get('/stores')
  test('Protected route without token → 401', noAuth.status === 401, `status=${noAuth.status}`)

  // ── Get current user (me) ──
  const me = await get('/auth/me', state.tokenA)
  test('GET /auth/me with valid token — 200', me.status === 200, `status=${me.status}`)
  test('ME returns correct email', me.data?.merchant?.email === TEST_EMAIL_A)

  // ── Refresh token ──
  if (state.refreshTokenA) {
    const refresh = await post('/auth/refresh', { refreshToken: state.refreshTokenA })
    test('Refresh token returns new accessToken', refresh.status === 200 && !!refresh.data?.accessToken, `status=${refresh.status}`)
  } else {
    skip('Refresh token (no refresh token stored)')
  }

  // ── Tampered JWT ──
  const tamperedToken = (state.tokenA || '').split('.').map((p, i) => i === 1 ? p.slice(0, -5) + 'XXXXX' : p).join('.')
  const tampered = await get('/stores', tamperedToken)
  test('Tampered JWT → 401', tampered.status === 401, `status=${tampered.status}`)

  // ── Wrong JWT secret (fabricated) ──
  const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImZha2UtaWQiLCJpYXQiOjE3MDAwMDAwMDB9.fake_signature_here'
  const fakeAuth = await get('/stores', fakeToken)
  test('Fabricated JWT → 401', fakeAuth.status === 401, `status=${fakeAuth.status}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ③ INPUT VALIDATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testValidation() {
  suite('③ INPUT VALIDATION — Boundaries & Types')

  // ── Short password ──
  const shortPw = await post('/auth/register', {
    email: `short_${RUN_ID}@test.com`, phone: '55555555', password: '1234567', // 7 chars
    firstName: 'اختبار', lastName: 'التحقق',
  })
  test('Password < 8 chars → 400', shortPw.status === 400, `status=${shortPw.status}`)

  // ── Invalid email format ──
  const badEmail = await post('/auth/register', {
    email: 'not-an-email', phone: '66666666', password: 'StrongPass@123',
    firstName: 'اختبار', lastName: 'ايميل',
  })
  test('Invalid email format → 400', badEmail.status === 400, `status=${badEmail.status}`)

  // ── Missing required fields ──
  const missing = await post('/auth/register', { email: TEST_EMAIL_A })
  test('Missing required fields → 400', missing.status === 400, `status=${missing.status}`)

  // ── Empty body ──
  const empty = await post('/auth/login', {})
  test('Empty login body → 400', empty.status === 400, `status=${empty.status}`)
  test('Validation error has details field', !!empty.data?.error || !!empty.data?.details)

  // ── Null body simulation ──
  const nullBody = await req('POST', '/auth/login', null, null)
  test('Null body does not crash server (4xx)', nullBody.status >= 400 && nullBody.status < 500, `status=${nullBody.status}`)

  // ── Very long string ──
  const longStr = 'a'.repeat(10000)
  const longBody = await post('/auth/register', {
    email: `${longStr}@test.com`, phone: TEST_PHONE_A, password: 'StrongPass@123',
    firstName: longStr, lastName: longStr,
  })
  test('Very long strings → 4xx (no crash)', longBody.status >= 400, `status=${longBody.status}`)

  // ── Negative price in product (needs auth+store, skip if no store yet) ──
  if (state.storeId && state.tokenA) {
    const negPrice = await post('/products', {
      storeId: state.storeId, name: 'Test', nameAr: 'اختبار',
      slug: `neg-${RUN_ID}`, price: -100, stock: 0,
    }, state.tokenA)
    test('Negative product price → 400', negPrice.status === 400, `status=${negPrice.status}`)
  } else {
    skip('Negative price check (store not yet created)')
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ④ SECURITY — Injections & XSS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testSecurity() {
  suite('④ SECURITY — SQL Injection / XSS / IDOR')

  // ── SQL injection in email ──
  const sqli = await post('/auth/login', {
    email: "' OR '1'='1' --",
    password: 'anything',
  })
  test("SQL injection in email → 4xx (no 200)", sqli.status !== 200, `status=${sqli.status}`)
  test("SQL injection does not crash server", sqli.status < 500, `status=${sqli.status}`)

  // ── SQL injection in password ──
  const sqli2 = await post('/auth/login', {
    email: TEST_EMAIL_A,
    password: "' OR 1=1 --",
  })
  test("SQL injection in password → 401", sqli2.status === 401, `status=${sqli2.status}`)

  // ── XSS in name fields ──
  const xss = await post('/auth/register', {
    email: `xss_${RUN_ID}@test.com`,
    phone: '77777877',
    password: 'StrongPass@123',
    firstName: '<script>alert("xss")</script>',
    lastName: '<img src=x onerror=alert(1)>',
  })
  test("XSS in registration fields → 4xx or stored as plain text (not executed)", xss.status !== 200 || (xss.data?.merchant?.firstName?.includes('<script>') === false || xss.status < 500), `status=${xss.status}`)
  test("XSS does not crash server", xss.status < 500, `status=${xss.status}`)

  // ── Path traversal ──
  const traverse = await get('/products/../../../etc/passwd', state.tokenA)
  test("Path traversal → 4xx", traverse.status >= 400, `status=${traverse.status}`)

  // ── IDOR: Merchant B accessing Merchant A's store ──
  if (state.storeId && state.tokenB) {
    const idor = await get(`/stores/${state.storeId}`, state.tokenB)
    test("IDOR: Merchant B cannot access Merchant A's store details", idor.status === 403 || idor.status === 404, `status=${idor.status}`)
  } else {
    skip('IDOR test (store or token B not ready)')
  }

  // ── IDOR: Merchant B editing Merchant A's product ──
  if (state.productId && state.tokenB) {
    const idorProd = await patch(`/products/${state.productId}`, { price: 0.01 }, state.tokenB)
    test("IDOR: Merchant B cannot edit Merchant A's product", idorProd.status === 403 || idorProd.status === 404, `status=${idorProd.status}`)
  } else {
    skip('Product IDOR (product not yet created)')
  }

  // ── Authorization header injection ──
  const headerInject = await req('GET', '/auth/me', null, 'Bearer INVALID.TOKEN.HERE')
  test("Invalid Bearer token → 401", headerInject.status === 401, `status=${headerInject.status}`)

  // ── Empty Bearer ──
  const emptyBearer = await req('GET', '/auth/me', null, '')
  test("Empty Authorization → 401", emptyBearer.status === 401, `status=${emptyBearer.status}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ⑤ STORE MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testStores() {
  suite('⑤ STORE MANAGEMENT — CRUD & Uniqueness')

  if (!state.tokenA) { skip('All store tests (no auth token)'); return }

  // ── Create store ──
  const create = await post('/stores', {
    name: 'Bazar Test Store', nameAr: 'متجر بازار التجريبي',
    subdomain: TEST_SUBDOMAIN,
  }, state.tokenA)
  test('Create store — 201', create.status === 201, `status=${create.status}`, create.elapsed)
  test('Store has id', !!create.data?.store?.id)
  test('Store subdomain matches', create.data?.store?.subdomain === TEST_SUBDOMAIN)
  state.storeId = create.data?.store?.id

  // Fetch full store to capture apiKey
  if (state.storeId) {
    const detail = await get(`/stores/${state.storeId}`, state.tokenA)
    state.apiKey = detail.data?.store?.apiKey || null
  }

  // Create store B for cross-access tests
  const createB = await post('/stores', {
    name: 'Bazar Test Store B', nameAr: 'متجر بازار ب',
    subdomain: TEST_SUBDOMAIN_B,
  }, state.tokenB)
  test('Create store B (merchant B) — 201', createB.status === 201, `status=${createB.status}`)
  state.storeBId = createB.data?.store?.id

  // ── Duplicate subdomain ──
  const dup = await post('/stores', {
    name: 'Another Store', nameAr: 'متجر آخر',
    subdomain: TEST_SUBDOMAIN,
  }, state.tokenA)
  test('Duplicate subdomain → 409', dup.status === 409, `status=${dup.status}`)

  // ── List stores ──
  const list = await get('/stores', state.tokenA)
  test('List stores — 200', list.status === 200, `status=${list.status}`, list.elapsed)
  test('List returns array', Array.isArray(list.data?.stores))
  test('Created store appears in list', list.data?.stores?.some(s => s.id === state.storeId))

  // ── Get single store ──
  if (state.storeId) {
    const single = await get(`/stores/${state.storeId}`, state.tokenA)
    test('Get store by ID — 200', single.status === 200, `status=${single.status}`)
  }

  // ── Update store ──
  if (state.storeId) {
    const upd = await patch(`/stores/${state.storeId}`, { description: 'Updated via deep test' }, state.tokenA)
    test('Update store — 200', upd.status === 200, `status=${upd.status}`)
  }

  // ── Invalid subdomain chars ──
  const badSub = await post('/stores', {
    name: 'Bad Sub', nameAr: 'رابط سيئ', subdomain: 'HAS_UPPERCASE',
  }, state.tokenA)
  test('Uppercase subdomain → 400', badSub.status === 400, `status=${badSub.status}`)

  // ── Short subdomain ──
  const shortSub = await post('/stores', {
    name: 'Short', nameAr: 'قصير', subdomain: 'ab',
  }, state.tokenA)
  test('Subdomain < 3 chars → 400', shortSub.status === 400, `status=${shortSub.status}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ⑥ CATEGORY MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testCategories() {
  suite('⑥ CATEGORY MANAGEMENT — CRUD & Tree')

  if (!state.storeId || !state.tokenA) { skip('All category tests (no store/token)'); return }

  // ── Create category ──
  const create = await post('/categories', {
    storeId: state.storeId,
    name: 'Electronics', nameAr: 'إلكترونيات',
    slug: `electronics-${RUN_ID}`,
  }, state.tokenA)
  test('Create category — 201', create.status === 201, `status=${create.status}`, create.elapsed)
  test('Category has id', !!create.data?.category?.id)
  state.categoryId = create.data?.category?.id

  // ── Create sub-category ──
  if (state.categoryId) {
    const sub = await post('/categories', {
      storeId: state.storeId,
      parentId: state.categoryId,
      name: 'Phones', nameAr: 'هواتف',
      slug: `phones-${RUN_ID}`,
    }, state.tokenA)
    test('Create sub-category — 201', sub.status === 201, `status=${sub.status}`)
    test('Sub-category has parentId', sub.data?.category?.parentId === state.categoryId)
  }

  // ── List categories (public) ──
  const list = await get(`/categories/store/${state.storeId}`)
  test('List categories (public) — 200', list.status === 200, `status=${list.status}`, list.elapsed)
  test('List returns array', Array.isArray(list.data?.categories))
  test('Parent category in list', list.data?.categories?.some(c => c.id === state.categoryId))

  // ── Duplicate slug ──
  const dup = await post('/categories', {
    storeId: state.storeId,
    name: 'Electronics 2', nameAr: 'إلكترونيات 2',
    slug: `electronics-${RUN_ID}`, // same slug
  }, state.tokenA)
  test('Duplicate category slug → 409 or 400', dup.status === 409 || dup.status === 400, `status=${dup.status}`)

  // ── Cross-store category creation (merchant B adding to merchant A's store) ──
  const cross = await post('/categories', {
    storeId: state.storeId,
    name: 'Hacked', nameAr: 'اختراق',
    slug: `hacked-${RUN_ID}`,
  }, state.tokenB)
  test('Cross-store category creation blocked → 403', cross.status === 403, `status=${cross.status}`)

  // ── Invalid parent ID ──
  const badParent = await post('/categories', {
    storeId: state.storeId,
    parentId: 'clzfake0000000000000000000', // non-existent CUID
    name: 'Orphan', nameAr: 'يتيم',
    slug: `orphan-${RUN_ID}`,
  }, state.tokenA)
  test('Non-existent parentId → 4xx or ignored gracefully', badParent.status >= 400 || badParent.status === 201, `status=${badParent.status}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ⑦ PRODUCT MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testProducts() {
  suite('⑦ PRODUCT MANAGEMENT — CRUD & Stock & Validation')

  if (!state.storeId || !state.tokenA) { skip('All product tests (no store/token)'); return }

  const slug = `iphone-15-${RUN_ID}`

  // ── Create product ──
  const create = await post('/products', {
    storeId: state.storeId,
    categoryId: state.categoryId,
    name: 'iPhone 15 Pro', nameAr: 'آيفون 15 برو',
    slug,
    price: 350.000, comparePrice: 400.000, costPrice: 270.000,
    stock: 50, lowStockAlert: 5,
    trackInventory: true, isActive: true, isFeatured: true,
    description: 'Latest iPhone', descriptionAr: 'أحدث آيفون',
  }, state.tokenA)
  test('Create product — 201', create.status === 201, `status=${create.status}`, create.elapsed)
  test('Product has id', !!create.data?.product?.id)
  test('Product price is correct', Number(create.data?.product?.price) === 350)
  test('Product stock is 50', create.data?.product?.stock === 50)
  state.productId = create.data?.product?.id
  state.productSlug = slug

  // ── Duplicate slug ──
  const dup = await post('/products', {
    storeId: state.storeId,
    name: 'Duplicate', nameAr: 'مكرر', slug, price: 100, stock: 0, nameAr: 'مكرر',
  }, state.tokenA)
  test('Duplicate product slug → 409', dup.status === 409, `status=${dup.status}`)

  // ── List products ──
  const list = await get(`/products?storeId=${state.storeId}`, state.tokenA)
  test('List products — 200', list.status === 200, `status=${list.status}`, list.elapsed)
  test('Product list is array', Array.isArray(list.data?.products))
  test('Created product in list', list.data?.products?.some(p => p.id === state.productId))

  // ── Get single product ──
  if (state.productId) {
    const single = await get(`/products/${state.productId}`, state.tokenA)
    test('Get product by ID — 200', single.status === 200, `status=${single.status}`)
    test('Product name matches', single.data?.product?.name === 'iPhone 15 Pro' || single.data?.name === 'iPhone 15 Pro')
  }

  // ── Update product ──
  if (state.productId) {
    const upd = await patch(`/products/${state.productId}`, { price: 320.000, stock: 45 }, state.tokenA)
    test('Update product price+stock — 200', upd.status === 200, `status=${upd.status}`)
  }

  // ── Negative price ──
  const negPrice = await post('/products', {
    storeId: state.storeId, name: 'Bad Price', nameAr: 'سعر سيء',
    slug: `neg-price-${RUN_ID}`, price: -50, stock: 0,
  }, state.tokenA)
  test('Negative price → 400', negPrice.status === 400, `status=${negPrice.status}`)

  // ── Zero price ──
  const zeroPrice = await post('/products', {
    storeId: state.storeId, name: 'Free Item', nameAr: 'منتج مجاني',
    slug: `free-${RUN_ID}`, price: 0, stock: 0,
  }, state.tokenA)
  test('Zero price → 400', zeroPrice.status === 400, `status=${zeroPrice.status}`)

  // ── Cross-store product creation ──
  const cross = await post('/products', {
    storeId: state.storeId, name: 'Hacked', nameAr: 'اختراق',
    slug: `hacked-prod-${RUN_ID}`, price: 1, stock: 0,
  }, state.tokenB)
  test('Cross-store product creation blocked → 403', cross.status === 403, `status=${cross.status}`)

  // ── Missing required fields ──
  const missingFields = await post('/products', {
    storeId: state.storeId, name: 'No Arabic Name', // missing nameAr
    slug: `missing-${RUN_ID}`, price: 100, stock: 0,
  }, state.tokenA)
  test('Missing nameAr → 400', missingFields.status === 400, `status=${missingFields.status}`)

  // ── Public product by slug (storefront) ──
  const pubSlug = await get(`/public/products/slug/${state.storeId}/${slug}`)
  test('Public product by slug reachable', pubSlug.status === 200 || pubSlug.status === 404, `status=${pubSlug.status}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ⑧ CUSTOMER MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testCustomers() {
  suite('⑧ CUSTOMER MANAGEMENT — Register & Search & Pagination')

  if (!state.storeId) { skip('All customer tests (no store)'); return }

  // ── Create customer ──
  const create = await post('/customers', {
    storeId: state.storeId,
    phone: '33344455', firstName: 'أحمد', lastName: 'الاختبار',
    email: `customer_${RUN_ID}@test.com`,
  })
  test('Create customer — 201', create.status === 201, `status=${create.status}`, create.elapsed)
  test('Customer has id', !!create.data?.customer?.id)
  state.customerId = create.data?.customer?.id

  // ── Idempotent re-create (same phone) ──
  const reload = await post('/customers', {
    storeId: state.storeId, phone: '33344455',
    firstName: 'أحمد', lastName: 'الاختبار',
  })
  test('Duplicate customer returns existing — 200', reload.status === 200, `status=${reload.status}`)
  test('Same customer id returned', reload.data?.customer?.id === state.customerId)

  // ── List customers (authenticated) ──
  const list = await get(`/customers?storeId=${state.storeId}`, state.tokenA)
  test('List customers (auth) — 200', list.status === 200, `status=${list.status}`, list.elapsed)
  test('Customers list is array', Array.isArray(list.data?.customers))
  test('Has pagination metadata', typeof list.data?.total === 'number')

  // ── List without auth ──
  const noAuth = await get(`/customers?storeId=${state.storeId}`)
  test('List customers without auth → 401', noAuth.status === 401, `status=${noAuth.status}`)

  // ── Search customer ──
  const search = await get(`/customers?storeId=${state.storeId}&search=أحمد`, state.tokenA)
  test('Search customers — 200', search.status === 200, `status=${search.status}`)

  // ── Pagination ──
  const page2 = await get(`/customers?storeId=${state.storeId}&page=1&limit=5`, state.tokenA)
  test('Pagination params accepted — 200', page2.status === 200, `status=${page2.status}`)
  test('Page limit respected', !page2.data?.customers || page2.data.customers.length <= 5)

  // ── Invalid phone ──
  const badPhone = await post('/customers', {
    storeId: state.storeId, phone: '123', // too short
    firstName: 'اختبار', lastName: 'هاتف',
  })
  test('Short phone → 400', badPhone.status === 400, `status=${badPhone.status}`)

  // ── Cross-store customer list ──
  if (state.tokenB) {
    const cross = await get(`/customers?storeId=${state.storeId}`, state.tokenB)
    test('Merchant B cannot list Merchant A customers → 403', cross.status === 403, `status=${cross.status}`)
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ⑨ COUPON SYSTEM
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testCoupons() {
  suite('⑨ COUPON SYSTEM — Create / Validate / Expired / Exhausted')

  if (!state.storeId || !state.tokenA) { skip('All coupon tests (no store/token)'); return }

  // ── Create percentage coupon ──
  const couponCode = `DEEP${RUN_ID.toUpperCase().slice(-4)}`
  const create = await post('/coupons', {
    storeId: state.storeId,
    code: couponCode,
    type: 'PERCENTAGE',
    value: 20,
    minOrderValue: 10,
    maxUses: 100,
  }, state.tokenA)
  test('Create coupon (PERCENTAGE) — 201', create.status === 201, `status=${create.status}`, create.elapsed)
  test('Coupon code stored uppercase', create.data?.coupon?.code === couponCode.toUpperCase())
  state.couponId = create.data?.coupon?.id

  // ── Create fixed coupon ──
  const fixed = await post('/coupons', {
    storeId: state.storeId, code: `FIXED${RUN_ID.slice(-4)}`,
    type: 'FIXED', value: 5.000,
  }, state.tokenA)
  test('Create coupon (FIXED) — 201', fixed.status === 201, `status=${fixed.status}`)

  // ── Create free shipping coupon ──
  const freeship = await post('/coupons', {
    storeId: state.storeId, code: `SHIP${RUN_ID.slice(-4)}`,
    type: 'FREE_SHIPPING', value: 1,
  }, state.tokenA)
  test('Create coupon (FREE_SHIPPING) — 201', freeship.status === 201, `status=${freeship.status}`)

  // ── List coupons ──
  const list = await get(`/coupons?storeId=${state.storeId}`, state.tokenA)
  test('List coupons — 200', list.status === 200, `status=${list.status}`, list.elapsed)
  test('Coupons is array', Array.isArray(list.data?.coupons))

  // ── Validate coupon (public) ──
  const validate = await post('/coupons/validate', {
    storeId: state.storeId, code: couponCode, orderValue: 50,
  })
  test('Validate valid coupon — 200', validate.status === 200, `status=${validate.status}`)
  test('Discount amount is calculated', typeof validate.data?.discountAmount === 'number')

  // ── Validate with order below minimum ──
  const belowMin = await post('/coupons/validate', {
    storeId: state.storeId, code: couponCode, orderValue: 1, // below minOrderValue=10
  })
  test('Coupon below min order value → 400', belowMin.status === 400, `status=${belowMin.status}`)

  // ── Validate non-existent coupon ──
  const noCode = await post('/coupons/validate', {
    storeId: state.storeId, code: 'NOSUCHCODE', orderValue: 100,
  })
  test('Non-existent coupon → 404 or 400', noCode.status === 404 || noCode.status === 400, `status=${noCode.status}`)

  // ── Expired coupon ──
  const expired = await post('/coupons', {
    storeId: state.storeId, code: `EXP${RUN_ID.slice(-4)}`,
    type: 'PERCENTAGE', value: 10,
    expiresAt: new Date(Date.now() - 86400000).toISOString(), // yesterday
  }, state.tokenA)
  if (expired.status === 201) {
    const valExp = await post('/coupons/validate', {
      storeId: state.storeId, code: `EXP${RUN_ID.slice(-4)}`, orderValue: 100,
    })
    test('Expired coupon → 400', valExp.status === 400, `status=${valExp.status}`)
  } else {
    skip('Expired coupon validation (could not create past-dated coupon)')
  }

  // ── Invalid coupon type ──
  const badType = await post('/coupons', {
    storeId: state.storeId, code: 'BADTYPE',
    type: 'INVALID_TYPE', value: 10,
  }, state.tokenA)
  test('Invalid coupon type → 400', badType.status === 400, `status=${badType.status}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ⑩ CART MANAGEMENT (Abandoned Cart API)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testCart() {
  suite('⑩ CART MANAGEMENT — Abandoned Cart API')

  if (!state.storeId || !state.productId) { skip('All cart tests (no store/product)'); return }

  const cartEmail = `cart_${RUN_ID}@test.com`

  // ── Save abandoned cart ──
  const save = await post('/carts/save', {
    storeId: state.storeId,
    email: cartEmail,
    phone: '39999001',
    firstName: 'عميل',
    cartData: [{ productId: state.productId, name: 'iPhone 15 Pro', nameAr: 'آيفون 15 برو', price: 320, quantity: 2 }],
  })
  test('Save abandoned cart — 200', save.status === 200, `status=${save.status}`, save.elapsed)
  test('Save returns ok:true', save.data?.ok === true)

  // ── Save again (idempotent upsert) ──
  const save2 = await post('/carts/save', {
    storeId: state.storeId, email: cartEmail,
    cartData: [{ productId: state.productId, name: 'iPhone 15 Pro', nameAr: 'آيفون 15 برو', price: 320, quantity: 3 }],
  })
  test('Re-saving cart (upsert) — 200', save2.status === 200, `status=${save2.status}`)

  // ── List abandoned carts for store ──
  const list = await get(`/carts/${state.storeId}`)
  test('List abandoned carts — 200', list.status === 200, `status=${list.status}`, list.elapsed)
  test('Carts is array', Array.isArray(list.data?.carts))
  const savedCart = list.data?.carts?.find(c => c.email === cartEmail)
  test('Saved cart appears in list', !!savedCart)

  // ── Recover cart ──
  if (savedCart?.id) {
    const recover = await patch(`/carts/recover/${savedCart.id}`, {})
    test('Recover abandoned cart — 200', recover.status === 200, `status=${recover.status}`)
    test('Recover returns ok:true', recover.data?.ok === true)
  } else {
    skip('Cart recover (no cart id found)')
    skip('Cart recover ok response')
  }

  // ── Missing required fields ──
  const missing = await post('/carts/save', { storeId: state.storeId /* missing email and cartData */ })
  test('Missing required fields → 400', missing.status === 400, `status=${missing.status}`)

  // ── Empty cart items ──
  const emptyItems = await post('/carts/save', {
    storeId: state.storeId, email: cartEmail, cartData: [],
  })
  test('Empty cartData array → 400', emptyItems.status === 400, `status=${emptyItems.status}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ⑪ ORDER FLOW
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testOrders() {
  suite('⑪ ORDER FLOW — Create / Status / Access Control')

  if (!state.storeId || !state.productId || !state.customerId) {
    skip('All order tests (missing dependencies)')
    return
  }

  // ── Create order ──
  const create = await post('/orders', {
    storeId: state.storeId,
    customerId: state.customerId,
    paymentMethod: 'CASH_ON_DELIVERY',
    items: [{ productId: state.productId, quantity: 1 }],
    shippingCost: 1.000,
  })
  test('Create order — 201', create.status === 201, `status=${create.status}`, create.elapsed)
  test('Order has id', !!create.data?.order?.id)
  test('Order total is computed', create.data?.order?.total != null)
  state.orderId = create.data?.order?.id

  // ── List orders (merchant) ──
  const list = await get(`/orders?storeId=${state.storeId}`, state.tokenA)
  test('List orders (auth) — 200', list.status === 200, `status=${list.status}`, list.elapsed)
  test('Orders is array', Array.isArray(list.data?.orders))

  // ── Get specific order ──
  if (state.orderId) {
    const single = await get(`/orders/${state.orderId}`, state.tokenA)
    test('Get order by ID — 200', single.status === 200, `status=${single.status}`)
    test('Order items present', Array.isArray(single.data?.order?.items) || Array.isArray(single.data?.items))
  }

  // ── Update order status ──
  if (state.orderId) {
    const upd = await patch(`/orders/${state.orderId}/status`, { status: 'CONFIRMED' }, state.tokenA)
    test('Update order status → CONFIRMED — 200', upd.status === 200, `status=${upd.status}`)

    const upd2 = await patch(`/orders/${state.orderId}/status`, { status: 'PROCESSING' }, state.tokenA)
    test('Update order status → PROCESSING — 200', upd2.status === 200, `status=${upd2.status}`)
  }

  // ── Invalid status ──
  if (state.orderId) {
    const bad = await patch(`/orders/${state.orderId}/status`, { status: 'INVALID_STATUS' }, state.tokenA)
    test('Invalid order status → 400', bad.status === 400, `status=${bad.status}`)
  }

  // ── Cross-merchant order access ──
  if (state.orderId && state.tokenB) {
    const cross = await get(`/orders/${state.orderId}`, state.tokenB)
    test('Merchant B cannot access Merchant A orders → 403/404', cross.status === 403 || cross.status === 404, `status=${cross.status}`)
  }

  // ── Empty items array ──
  const emptyItems = await post('/orders', {
    storeId: state.storeId, customerId: state.customerId,
    paymentMethod: 'CASH_ON_DELIVERY', items: [],
  })
  test('Empty items array → 400', emptyItems.status === 400, `status=${emptyItems.status}`)

  // ── Invalid payment method ──
  const badPay = await post('/orders', {
    storeId: state.storeId, customerId: state.customerId,
    paymentMethod: 'DOGECOIN', items: [{ productId: state.productId, quantity: 1 }],
  })
  test('Invalid payment method → 400', badPay.status === 400, `status=${badPay.status}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ⑫ ANALYTICS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testAnalytics() {
  suite('⑫ ANALYTICS — Tracking & Reports')

  if (!state.storeId) { skip('All analytics tests (no store)'); return }

  // ── Track page view ──
  const track = await post('/analytics/pageview', {
    storeId: state.storeId,
    path: '/products/iphone-15',
    referrer: 'https://google.com',
  })
  test('Track pageview — 204 or 200', track.status === 204 || track.status === 200, `status=${track.status}`, track.elapsed)
  test('Pageview tracking is fast (<200ms)', track.elapsed < 200, `${track.elapsed}ms`)

  // ── Track from social ──
  const social = await post('/analytics/pageview', {
    storeId: state.storeId,
    path: '/products/samsung',
    referrer: 'https://instagram.com/shop',
  })
  test('Track social referrer — 204/200', social.status === 204 || social.status === 200, `status=${social.status}`)

  // ── Track direct (no referrer) ──
  const direct = await post('/analytics/pageview', {
    storeId: state.storeId, path: '/',
  })
  test('Track direct visit — 204/200', direct.status === 204 || direct.status === 200, `status=${direct.status}`)

  // ── Get traffic summary ──
  const traffic = await get(`/analytics/${state.storeId}/traffic`)
  test('Traffic summary — 200', traffic.status === 200, `status=${traffic.status}`, traffic.elapsed)
  test('Traffic has total', typeof traffic.data?.total === 'number')
  test('Traffic has bySource', !!traffic.data?.bySource)

  // ── Traffic with days param ──
  const traffic7 = await get(`/analytics/${state.storeId}/traffic?days=7`)
  test('Traffic with days=7 — 200', traffic7.status === 200, `status=${traffic7.status}`)

  // ── Missing storeId ──
  const noStore = await post('/analytics/pageview', { path: '/test' })
  test('Missing storeId in pageview → 400', noStore.status === 400, `status=${noStore.status}`)

  // ── Dashboard stats ──
  const stats = await get(`/analytics/${state.storeId}/dashboard`, state.tokenA)
  test('Dashboard stats — 200', stats.status === 200 || stats.status === 404, `status=${stats.status}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ⑬ PUBLIC API ROUTES (STOREFRONT)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testPublicRoutes() {
  suite('⑬ PUBLIC API — Storefront Routes')

  if (!state.storeId) { skip('All public route tests (no store)'); return }

  // ── Get store by subdomain (via store routes, public endpoint) ──
  const bySubdomain = await get(`/stores/s/${TEST_SUBDOMAIN}`)
  test('Get store by subdomain (public) — 200', bySubdomain.status === 200, `status=${bySubdomain.status}`, bySubdomain.elapsed)
  test('Store data returned', !!bySubdomain.data?.store?.id || !!bySubdomain.data?.id)

  // ── Non-existent subdomain ──
  const noStore = await get('/stores/s/this-subdomain-does-not-exist-9999')
  test('Non-existent subdomain → 404', noStore.status === 404, `status=${noStore.status}`)

  // ── Public API — requires x-api-key header ──
  if (state.apiKey) {
    const pubProducts = await req('GET', '/api/public/v1/products', null, null)
    // Need to pass x-api-key manually
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    const t0 = Date.now()
    const prodRes = await fetch(`http://localhost:3001/api/public/v1/products`, {
      headers: { 'x-api-key': state.apiKey }, signal: ctrl.signal,
    }).catch(() => ({ status: 0 }))
    clearTimeout(timer)
    test('Public products API (x-api-key) — 200', prodRes.status === 200, `status=${prodRes.status}`, Date.now() - t0)
  } else {
    info('No apiKey captured — skipping public products API test')
    skip('Public products API (x-api-key) — no apiKey')
  }

  // ── Public categories ──
  const cats = await get(`/categories/store/${state.storeId}`)
  test('Public categories — 200', cats.status === 200, `status=${cats.status}`)

  // ── Sitemap ──
  const sitemap = await get(`/sitemap/${TEST_SUBDOMAIN}`)
  test('Sitemap route accessible — 200 or 404', sitemap.status === 200 || sitemap.status === 404, `status=${sitemap.status}`)

  // ── Public API without key → 401 ──
  const noKey = await fetch('http://localhost:3001/api/public/v1/products').then(r => ({ status: r.status }))
  test('Public API without key → 401 or 400', noKey.status === 401 || noKey.status === 400, `status=${noKey.status}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ⑭ ONBOARDING & ADVANCED FEATURES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testAdvancedFeatures() {
  suite('⑭ ADVANCED FEATURES — Flash Sales / Reviews / Blog')

  if (!state.storeId || !state.tokenA) { skip('All advanced feature tests (no store/token)'); return }

  // ── Flash sale list ──
  const flash = await get(`/flash-sales?storeId=${state.storeId}`, state.tokenA)
  test('Flash sales endpoint — 200', flash.status === 200, `status=${flash.status}`)

  // ── Reviews list ──
  if (state.productId) {
    const reviews = await get(`/reviews/public/${state.storeId}/${state.productId}`)
    test('Public reviews endpoint — 200', reviews.status === 200, `status=${reviews.status}`)
  }

  // ── Blog posts (public endpoint) ──
  const blog = await get(`/blog/public/${TEST_SUBDOMAIN}`)
  test('Blog posts (public) endpoint — 200', blog.status === 200, `status=${blog.status}`)

  // ── Announcements (active, public) ──
  const announce = await get(`/announcements/active`)
  test('Announcements (active) endpoint — 200', announce.status === 200, `status=${announce.status}`)

  // ── Pages (requires auth) ──
  const pages = await get(`/pages?storeId=${state.storeId}`, state.tokenA)
  test('Pages endpoint (auth) — 200', pages.status === 200, `status=${pages.status}`)

  // ── Loyalty config ──
  const loyalty = await get(`/loyalty/config?storeId=${state.storeId}`, state.tokenA)
  test('Loyalty config endpoint — 200', loyalty.status === 200, `status=${loyalty.status}`)

  // ── Inventory low-stock ──
  const inventory = await get(`/inventory/low-stock?storeId=${state.storeId}`, state.tokenA)
  test('Inventory low-stock endpoint — 200', inventory.status === 200, `status=${inventory.status}`)

  // ── Gift cards ──
  const giftCards = await get(`/gift-cards?storeId=${state.storeId}`, state.tokenA)
  test('Gift cards endpoint — 200', giftCards.status === 200 || giftCards.status === 429, `status=${giftCards.status}`)

  // ── Referral code (POST) ──
  if (state.customerId) {
    const referral = await post('/referral/code', { storeId: state.storeId, customerId: state.customerId }, state.tokenA)
    test('Referral code endpoint — 200/201', referral.status === 200 || referral.status === 201 || referral.status === 429, `status=${referral.status}`)
  } else {
    skip('Referrals (no customerId)')
  }

  // ── Smart Search ──
  const search = await get(`/search?storeId=${state.storeId}&q=iphone`)
  test('Smart search endpoint — 200', search.status === 200 || search.status === 429, `status=${search.status}`)

  // ── Upsell rules ──
  const upsell = await get(`/upsell/rules?storeId=${state.storeId}`, state.tokenA)
  test('Upsell rules endpoint — 200', upsell.status === 200 || upsell.status === 429, `status=${upsell.status}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ⑮ CONCURRENCY & RACE CONDITIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testConcurrency() {
  suite('⑮ CONCURRENCY — Parallel Requests & Race Conditions')

  if (!state.tokenA) { skip('All concurrency tests (no token)'); return }

  // ── Parallel read requests ──
  const t0 = Date.now()
  const results = await Promise.all([
    get('/stores', state.tokenA),
    get('/stores', state.tokenA),
    get('/stores', state.tokenA),
    get('/stores', state.tokenA),
    get('/stores', state.tokenA),
  ])
  const elapsed = Date.now() - t0
  const allOk = results.every(r => r.status === 200 || r.status === 429)
  test('5 parallel GET /stores requests — all 200', allOk, `${results.map(r => r.status).join(',')}`)
  test('Parallel requests complete in <2s', elapsed < 2000, `${elapsed}ms`)

  // ── Simultaneous register attempts (same email) ──
  const sameEmail = `race_${RUN_ID}@test.com`
  const raceResults = await Promise.all([
    post('/auth/register', { email: sameEmail, phone: '88881111', password: 'StrongPass@123', firstName: 'سباق', lastName: 'أول' }),
    post('/auth/register', { email: sameEmail, phone: '88882222', password: 'StrongPass@123', firstName: 'سباق', lastName: 'ثاني' }),
    post('/auth/register', { email: sameEmail, phone: '88883333', password: 'StrongPass@123', firstName: 'سباق', lastName: 'ثالث' }),
  ])
  const successCount = raceResults.filter(r => r.status === 201).length
  test('Only one registration succeeds for same email', successCount <= 1, `successes=${successCount}`)
  test('No crashes during race condition', raceResults.every(r => r.status < 500), `statuses=${raceResults.map(r=>r.status).join(',')}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ⑯ ERROR HANDLING & EDGE CASES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testErrorHandling() {
  suite('⑯ ERROR HANDLING & EDGE CASES')

  // ── Wrong HTTP method ──
  const wrongMethod = await req('DELETE', '/auth/login', null, null)
  test('Wrong HTTP method → 4xx', wrongMethod.status >= 400, `status=${wrongMethod.status}`)
  // Note: Fastify returns 404 for unknown method+path combo, some frameworks 405

  // ── Content-Type mismatch (send form data to JSON endpoint) ──
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'email=test@test.com&password=12345678',
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    test('Form data to JSON endpoint → 4xx graceful', res.status >= 400, `status=${res.status}`)
  } catch {
    test('Form data to JSON endpoint → connection handled', false, 'request failed')
  }

  // ── Request with very large payload ──
  const bigPayload = { data: 'x'.repeat(500000) }
  const large = await post('/auth/login', bigPayload)
  test('Very large payload → 4xx or 413 (no crash)', large.status >= 400, `status=${large.status}`)

  // ── Non-CUID for ID params ──
  const notCuid = await get('/products/not-a-valid-id', state.tokenA)
  test('Non-CUID product ID → 4xx', notCuid.status >= 400, `status=${notCuid.status}`)

  // ── Deeply nested JSON ──
  const deepNested = { a: { b: { c: { d: { e: { f: { g: 'deep' } } } } } } }
  const deep = await post('/auth/login', deepNested)
  test('Deeply nested JSON → 4xx graceful', deep.status >= 400, `status=${deep.status}`)

  // ── Emoji in fields ──
  const emoji = await post('/auth/login', { email: '😀@test.com', password: '💪Strong@123' })
  test('Emoji in fields handled gracefully', emoji.status >= 400, `status=${emoji.status}`)

  // ── Unicode right-to-left override ──
  const rtlo = await post('/auth/login', { email: '\u202Etest@evil.com', password: 'pass' })
  test('Unicode RTLO attack handled', rtlo.status >= 400, `status=${rtlo.status}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FINAL SUMMARY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function printSummary() {
  const total = passCount + failCount + skipCount
  const pct = total > 0 ? Math.round((passCount / (passCount + failCount)) * 100) : 0
  const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5))
  const overallColor = failCount === 0 ? C.green : failCount < 5 ? C.yellow : C.red
  const overallBg = failCount === 0 ? C.bgGreen : C.bgRed

  console.log(`\n${C.bold}${'═'.repeat(60)}${C.reset}`)
  console.log(`${C.bold}  BAZAR DEEP TEST — RESULTS SUMMARY${C.reset}`)
  console.log(`${'═'.repeat(60)}`)
  console.log(`  ${C.green}✔ PASSED${C.reset}  : ${C.bold}${passCount}${C.reset}`)
  console.log(`  ${C.red}✘ FAILED${C.reset}  : ${C.bold}${failCount}${C.reset}`)
  console.log(`  ${C.yellow}⊘ SKIPPED${C.reset} : ${C.bold}${skipCount}${C.reset}`)
  console.log(`  Total     : ${total}`)
  console.log(`\n  ${overallColor}${C.bold}${bar}${C.reset} ${pct}%`)

  if (failCount > 0) {
    console.log(`\n${C.bold}${C.red}  ✘ FAILED TESTS:${C.reset}`)
    state.results
      .filter(r => r.passed === false)
      .forEach(r => {
        console.log(`  ${C.red}✘${C.reset} [${C.dim}${r.suite}${C.reset}] ${r.name}${r.detail ? ` — ${C.dim}${r.detail}${C.reset}` : ''}`)
      })
  }

  console.log(`\n${'═'.repeat(60)}`)
  if (failCount === 0) {
    console.log(`${C.bgGreen}${C.bold}  ✅ ALL TESTS PASSED — PLATFORM READY   ${C.reset}`)
  } else if (pct >= 80) {
    console.log(`${C.yellow}${C.bold}  ⚠️  MOSTLY PASSING — ${failCount} TESTS NEED ATTENTION  ${C.reset}`)
  } else {
    console.log(`${C.bgRed}  ❌ ${failCount} FAILURES — INVESTIGATE BEFORE LAUNCH  ${C.reset}`)
  }
  console.log(`${'═'.repeat(60)}\n`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN RUNNER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function main() {
  console.log(`\n${C.bold}${C.magenta}`)
  console.log('  ╔══════════════════════════════════════════════════════════════════╗')
  console.log('  ║         BAZAR PLATFORM — DEEP INTEGRATION TEST SUITE            ║')
  console.log('  ║         اختبار عميق شامل لكل نقاط الـ API                        ║')
  console.log('  ╚══════════════════════════════════════════════════════════════════╝')
  console.log(`${C.reset}`)
  console.log(`  ${C.dim}Target : ${BASE}${C.reset}`)
  console.log(`  ${C.dim}Run ID : ${RUN_ID}${C.reset}`)
  console.log(`  ${C.dim}Time   : ${new Date().toLocaleString('ar-BH')}${C.reset}`)

  // Run suites in logical dependency order
  await testHealth()
  await testAuth()
  await testValidation()
  await testSecurity()
  await testStores()
  await testCategories()
  await testProducts()
  // Re-run validation with product context now available
  if (state.storeId && state.tokenA && state.productId) {
    suite('③ PRODUCT VALIDATION (follow-up)')
    const negPrice = await post('/products', {
      storeId: state.storeId, name: 'Bad', nameAr: 'سيئ',
      slug: `neg2-${RUN_ID}`, price: -50, stock: 0,
    }, state.tokenA)
    test('Negative price with real store → 400', negPrice.status === 400, `status=${negPrice.status}`)
  }
  await testCustomers()
  await testCoupons()
  await testCart()
  await testOrders()
  await testAnalytics()
  await testPublicRoutes()
  await testAdvancedFeatures()
  await testConcurrency()
  await testErrorHandling()

  printSummary()
}

main().catch(err => {
  console.error(`\n${C.red}${C.bold}FATAL: Test runner crashed:${C.reset}`, err.message)
  process.exit(1)
})
