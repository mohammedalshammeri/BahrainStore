/**
 * Unified storage abstraction — uploads to S3/R2/MinIO when configured,
 * falls back to local disk otherwise.
 *
 * Required env vars for cloud storage:
 *   S3_ENDPOINT      — full endpoint URL (e.g. https://s3.amazonaws.com or https://<account>.r2.cloudflarestorage.com)
 *   S3_BUCKET        — bucket name
 *   S3_ACCESS_KEY    — access key ID
 *   S3_SECRET_KEY    — secret access key
 * Optional:
 *   S3_REGION        — defaults to "auto"
 *   S3_PUBLIC_URL    — public base URL for returned file URLs; defaults to `${S3_ENDPOINT}/${S3_BUCKET}`
 */

import fs from 'node:fs'
import path from 'node:path'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const {
  S3_ENDPOINT,
  S3_BUCKET,
  S3_ACCESS_KEY,
  S3_SECRET_KEY,
  S3_REGION = 'auto',
  S3_PUBLIC_URL,
  BACKEND_URL = 'http://localhost:3001',
} = process.env

const s3Client =
  S3_ENDPOINT && S3_BUCKET && S3_ACCESS_KEY && S3_SECRET_KEY
    ? new S3Client({
        endpoint: S3_ENDPOINT,
        region: S3_REGION,
        credentials: {
          accessKeyId: S3_ACCESS_KEY,
          secretAccessKey: S3_SECRET_KEY,
        },
        // Required for path-style buckets (MinIO, R2)
        forcePathStyle: true,
      })
    : null

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads')

/**
 * Upload a file buffer and return a publicly-accessible URL.
 * Writes to S3-compatible storage if configured, otherwise to local disk.
 */
export async function uploadFile(
  buffer: Buffer,
  filename: string,
  mimetype: string,
): Promise<string> {
  if (s3Client && S3_BUCKET) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: filename,
        Body: buffer,
        ContentType: mimetype,
      }),
    )
    const base = S3_PUBLIC_URL ?? `${S3_ENDPOINT}/${S3_BUCKET}`
    return `${base}/${filename}`
  }

  // Local disk fallback
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer)
  return `${BACKEND_URL}/uploads/${filename}`
}
