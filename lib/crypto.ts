/**
 * Secure Password Hashing Utilities using Web Crypto API SHA-256
 */

export function generateTemporaryPassword(): string {
  // Generate readable temporary password format: Saho@XXXX
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `Saho@${randomDigits}`;
}

export async function hashPassword(password: string): Promise<string> {
  if (!password) return '';
  const encoder = new TextEncoder();
  const data = encoder.encode(password.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(
  inputPassword: string,
  storedPasswordHash?: string
): Promise<boolean> {
  if (!storedPasswordHash || !inputPassword) return false;
  
  const inputHash = await hashPassword(inputPassword);
  // Verify with SHA-256 hash, or fallback to plain text for legacy database migration
  return storedPasswordHash === inputHash || storedPasswordHash === inputPassword.trim();
}
