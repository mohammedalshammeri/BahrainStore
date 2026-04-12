-- LOGIC-001: Add CouponUsage table for per-customer coupon tracking
-- LOGIC-005: Add InventoryLog table for audit trail
-- DB-001: Add indexes on orders table
-- DB-002: Add indexes on products table
-- DB-003: refreshToken already @unique (index exists)
-- DB-004: Convert kycStatus and Session.kind to proper enum types

-- CreateEnum: KycStatus
DO $$ BEGIN
    CREATE TYPE "KycStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: SessionKind
DO $$ BEGIN
    CREATE TYPE "SessionKind" AS ENUM ('REFRESH', 'OAUTH_EXCHANGE', 'GOOGLE_OAUTH_EXCHANGE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable merchants: kycStatus String -> KycStatus enum
ALTER TABLE "merchants"
  ALTER COLUMN "kycStatus" TYPE "KycStatus"
  USING "kycStatus"::"KycStatus",
  ALTER COLUMN "kycStatus" SET DEFAULT 'NONE'::"KycStatus";

-- AlterTable sessions: kind String -> SessionKind enum
ALTER TABLE "sessions"
  ALTER COLUMN "kind" TYPE "SessionKind"
  USING "kind"::"SessionKind",
  ALTER COLUMN "kind" SET DEFAULT 'REFRESH'::"SessionKind";

-- AlterTable coupons: add maxUsesPerCustomer column
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "maxUsesPerCustomer" INTEGER;

-- CreateTable coupon_usages
CREATE TABLE IF NOT EXISTS "coupon_usages" (
    "id"         TEXT NOT NULL,
    "couponId"   TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable inventory_logs
CREATE TABLE IF NOT EXISTS "inventory_logs" (
    "id"            TEXT NOT NULL,
    "productId"     TEXT NOT NULL,
    "storeId"       TEXT NOT NULL,
    "merchantId"    TEXT NOT NULL,
    "quantity"      INTEGER NOT NULL,
    "previousStock" INTEGER NOT NULL,
    "currentStock"  INTEGER NOT NULL,
    "reason"        TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: coupon_usages -> coupons
ALTER TABLE "coupon_usages"
  ADD CONSTRAINT "coupon_usages_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: inventory_logs -> products
ALTER TABLE "inventory_logs"
  ADD CONSTRAINT "inventory_logs_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex: coupon_usages lookup index (not unique — customers may use coupon multiple times)
CREATE INDEX IF NOT EXISTS "coupon_usages_couponId_customerId_idx"
  ON "coupon_usages"("couponId", "customerId");

-- CreateIndex: inventory_logs indexes
CREATE INDEX IF NOT EXISTS "inventory_logs_productId_createdAt_idx"
  ON "inventory_logs"("productId", "createdAt");

CREATE INDEX IF NOT EXISTS "inventory_logs_storeId_createdAt_idx"
  ON "inventory_logs"("storeId", "createdAt");

-- DB-001: orders indexes
CREATE INDEX IF NOT EXISTS "orders_storeId_createdAt_idx"
  ON "orders"("storeId", "createdAt");

CREATE INDEX IF NOT EXISTS "orders_storeId_status_idx"
  ON "orders"("storeId", "status");

CREATE INDEX IF NOT EXISTS "orders_storeId_paymentStatus_idx"
  ON "orders"("storeId", "paymentStatus");

-- DB-002: products indexes
CREATE INDEX IF NOT EXISTS "products_storeId_isActive_idx"
  ON "products"("storeId", "isActive");

CREATE INDEX IF NOT EXISTS "products_storeId_isFeatured_idx"
  ON "products"("storeId", "isFeatured");
