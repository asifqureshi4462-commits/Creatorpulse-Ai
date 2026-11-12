import crypto from 'node:crypto';
import { env } from '../config/environment.js';

const key = () => crypto.createHash('sha256').update(String(env.encryptionSecret)).digest();

/** AES-256-GCM. Output format: iv:tag:ciphertext (base64). */
export function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join(':');
}

export function decrypt(payload) {
  const [iv, tag, data] = payload.split(':').map((p) => Buffer.from(p, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
