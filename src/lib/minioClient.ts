import { Client } from 'minio'

let client: Client | null = null

function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export interface MinioConfig {
  endPoint: string
  port: number
  useSSL: boolean
  accessKey: string
  secretKey: string
}

export function getMinioConfig(): MinioConfig {
  const endPoint = getRequiredEnv('MINIO_ENDPOINT')
  const port = Number(process.env.MINIO_PORT ?? 9000)
  const useSSL = (process.env.MINIO_USE_SSL ?? 'false').toLowerCase() === 'true'
  const accessKey = getRequiredEnv('MINIO_ACCESS_KEY')
  const secretKey = getRequiredEnv('MINIO_SECRET_KEY')

  return {
    endPoint,
    port,
    useSSL,
    accessKey,
    secretKey,
  }
}

export function getMinioClient(): Client {
  if (typeof window !== 'undefined') {
    throw new Error('MinIO client is only available on the server')
  }

  if (!client) {
    const config = getMinioConfig()
    client = new Client(config)
  }

  return client
}

export function getMinioBucket(): string {
  return process.env.MINIO_BUCKET ?? 'ai-stylist'
}
