import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const PRESIGN_EXPIRY_SECONDS = 300

let client: S3Client | null = null

function r2Client(): S3Client {
  if (client) return client
  client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  })
  return client
}

function bucket(): string {
  return process.env.R2_BUCKET_NAME!
}

export function buildStorageKey(userId: string, itemType: string, itemId: number, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-140)
  return `${userId}/${itemType}/${itemId}/${crypto.randomUUID()}-${safeName}`
}

export async function createUploadUrl(storageKey: string, mimeType: string): Promise<string> {
  const command = new PutObjectCommand({ Bucket: bucket(), Key: storageKey, ContentType: mimeType })
  return getSignedUrl(r2Client(), command, { expiresIn: PRESIGN_EXPIRY_SECONDS })
}

export async function createDownloadUrl(storageKey: string, fileName: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket(),
    Key: storageKey,
    ResponseContentDisposition: `attachment; filename="${fileName.replace(/"/g, "")}"`,
  })
  return getSignedUrl(r2Client(), command, { expiresIn: PRESIGN_EXPIRY_SECONDS })
}

export async function deleteObject(storageKey: string): Promise<void> {
  await r2Client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: storageKey }))
}
