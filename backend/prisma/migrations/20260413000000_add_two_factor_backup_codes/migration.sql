-- Add two_factor_backup_codes table for 2FA recovery codes (NEW-003)
CREATE TABLE "two_factor_backup_codes" (
    "id"         TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "codeHash"   TEXT NOT NULL,
    "usedAt"     TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_backup_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "two_factor_backup_codes_merchantId_idx" ON "two_factor_backup_codes"("merchantId");

ALTER TABLE "two_factor_backup_codes"
    ADD CONSTRAINT "two_factor_backup_codes_merchantId_fkey"
    FOREIGN KEY ("merchantId")
    REFERENCES "merchants"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
