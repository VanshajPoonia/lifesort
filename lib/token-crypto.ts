import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const KEY_LENGTH = 32
const IV_LENGTH = 12
const FORMAT_VERSION = "v1"
const SCRYPT_SALT = "lifesort-oauth-v1"

let cachedKey: Buffer | null = null
let warnedAboutMissingKey = false

function loadKey(): Buffer | null {
  if (cachedKey) return cachedKey
  const secret = process.env.OAUTH_TOKEN_ENCRYPTION_KEY
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "OAUTH_TOKEN_ENCRYPTION_KEY env var must be set to a string of at least 32 characters in production"
      )
    }
    if (!warnedAboutMissingKey) {
      console.warn(
        "[token-crypto] OAUTH_TOKEN_ENCRYPTION_KEY is missing or too short — running in pass-through mode (dev only). Generate one with: openssl rand -base64 48"
      )
      warnedAboutMissingKey = true
    }
    return null
  }
  cachedKey = scryptSync(secret, SCRYPT_SALT, KEY_LENGTH)
  return cachedKey
}

export function encryptToken(plaintext: string | null | undefined): string | null {
  if (plaintext == null || plaintext === "") return null
  const key = loadKey()
  if (!key) return plaintext
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${FORMAT_VERSION}:${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`
}

export function decryptToken(value: string | null | undefined): string | null {
  if (value == null || value === "") return null
  if (!value.startsWith(`${FORMAT_VERSION}:`)) return value
  const parts = value.split(":")
  if (parts.length !== 4) return value
  const [, ivB64, authTagB64, ciphertextB64] = parts
  const key = loadKey()
  if (!key) {
    throw new Error("OAUTH_TOKEN_ENCRYPTION_KEY required to decrypt a v1-formatted token")
  }
  const iv = Buffer.from(ivB64, "base64")
  const authTag = Buffer.from(authTagB64, "base64")
  const ciphertext = Buffer.from(ciphertextB64, "base64")
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString("utf8")
}
