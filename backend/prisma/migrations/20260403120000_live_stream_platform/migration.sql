-- Add platform and embedUrl columns to live_streams
ALTER TABLE "live_streams" ADD COLUMN IF NOT EXISTS "platform" TEXT NOT NULL DEFAULT 'CUSTOM';
ALTER TABLE "live_streams" ADD COLUMN IF NOT EXISTS "embedUrl" TEXT;
