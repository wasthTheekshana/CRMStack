import { apiFetch } from '@/config/api';

export async function forgotPassword(email: string): Promise<void> {
  await apiFetch('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function verifyResetToken(token: string): Promise<{ valid: boolean }> {
  return apiFetch<{ valid: boolean }>('/api/auth/verify-reset-token', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await apiFetch('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}
