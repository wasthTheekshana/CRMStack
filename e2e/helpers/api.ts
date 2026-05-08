import crypto from 'crypto'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') })

const BASE = process.env.BACKEND_URL ?? 'http://localhost:4000'

/**
 * Mint a short-lived JWT for a test user directly using the backend's
 * JWT_SECRET, without hitting the /api/auth/login endpoint.
 * This avoids the login rate-limiter (10 req / 15 min / IP).
 */
export function mintTestJwt(payload: Record<string, unknown>, expiresInSec = 3600): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET not found in backend/.env')

  const header  = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const now     = Math.floor(Date.now() / 1000)
  const body    = Buffer.from(JSON.stringify({ ...payload, iat: now, exp: now + expiresInSec })).toString('base64url')
  const sig     = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

export async function apiLogin(
  email: string,
  password: string,
  subdomain: string,
): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Subdomain': subdomain },
    body:    JSON.stringify({ username: email, password }),
  })
  if (!res.ok) throw new Error(`Login failed ${res.status}: ${await res.text()}`)
  const cookie = res.headers.get('set-cookie') ?? ''
  const match  = cookie.match(/auth_token=([^;]+)/)
  if (!match) throw new Error('No auth_token in Set-Cookie header')
  return match[1]
}

export async function apiFetch(
  urlPath: string,
  token: string,
  subdomain: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`${BASE}${urlPath}`, {
    ...options,
    headers: {
      'Content-Type':      'application/json',
      'Authorization':     `Bearer ${token}`,
      'X-Tenant-Subdomain': subdomain,
      ...(options.headers as Record<string, string> | undefined ?? {}),
    },
  })
}
