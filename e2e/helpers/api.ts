const BASE = 'http://localhost:4000'

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
