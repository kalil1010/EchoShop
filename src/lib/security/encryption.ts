/**
 * Encryption utilities for sensitive data like 2FA secrets
 * Uses Node.js crypto module for AES-256-GCM encryption
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // 16 bytes for AES
const SALT_LENGTH = 64 // 64 bytes for salt
const TAG_LENGTH = 16 // 16 bytes for GCM tag
const KEY_LENGTH = 32 // 32 bytes for AES-256

/**
 * Get encryption key from environment variable
 * In production, this should be a strong, randomly generated key stored securely
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'default-key-change-in-production'
  
  if (key === 'default-key-change-in-production') {
    console.warn('[encryption] Using default encryption key. Change ENCRYPTION_KEY in production!')
  }

  // Derive a 32-byte key from the environment key using PBKDF2
  return crypto.pbkdf2Sync(key, 'echoshop-2fa-salt', 100000, KEY_LENGTH, 'sha256')
}

/**
 * Encrypt sensitive data (e.g., 2FA secret)
 */
export function encrypt(plaintext: string): string {
  try {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const tag = cipher.getAuthTag()

    // Combine IV + tag + encrypted data
    return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted
  } catch (error) {
    console.error('[encryption] Failed to encrypt:', error)
    throw new Error('Encryption failed')
  }
}

/**
 * Decrypt sensitive data (e.g., 2FA secret)
 */
export function decrypt(encryptedData: string): string {
  try {
    const key = getEncryptionKey()
    const parts = encryptedData.split(':')
    
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format')
    }

    const iv = Buffer.from(parts[0], 'hex')
    const tag = Buffer.from(parts[1], 'hex')
    const encrypted = parts[2]

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    console.error('[encryption] Failed to decrypt:', error)
    throw new Error('Decryption failed')
  }
}

/**
 * Generate backup codes for 2FA recovery
 */
export function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    // Generate 8-digit codes
    const code = crypto.randomInt(10000000, 99999999).toString()
    codes.push(code)
  }
  return codes
}

