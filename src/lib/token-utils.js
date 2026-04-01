import { encrypt, decrypt } from "@/lib/encryption";

/**
 * Encrypted tokens have the format: hex:hex:hex (iv:tag:ciphertext).
 * This detects whether a stored value is already encrypted.
 */
function isEncrypted(value) {
  if (!value) return false;
  const parts = value.split(":");
  return parts.length === 3 && parts.every((p) => /^[0-9a-f]+$/i.test(p));
}

/**
 * Encrypts a plaintext token. Returns as-is if already encrypted.
 */
export function encryptToken(plaintext) {
  if (!plaintext) return null;
  if (isEncrypted(plaintext)) return plaintext;
  return encrypt(plaintext);
}

/**
 * Decrypts a stored token. Returns as-is if plaintext (legacy migration).
 */
export function decryptToken(stored) {
  if (!stored) return null;
  if (!isEncrypted(stored)) return stored;
  return decrypt(stored);
}
