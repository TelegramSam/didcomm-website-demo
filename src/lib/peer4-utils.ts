import bs58 from 'bs58';
import * as varint from 'varint';

const base58btc = "z";
const ed25519_pub = 0xed;
const x25519_pub = 0xec;

/**
 * Encodes a byte array into a multibase base58btc string.
 * @param input - The byte array to encode.
 * @returns The multibase base58btc encoded string.
 */
export function toMultibaseB58(input: Uint8Array): string {
  const encoded = bs58.encode(input);
  return `${base58btc}${encoded}`;
}

/**
 * Encodes an Ed25519 public key with multicodec prefix for Multikey format.
 * @param publicKey - The Ed25519 public key bytes.
 * @returns The multibase base58btc encoded Multikey string.
 */
export function toMultikeyEd25519(publicKey: Uint8Array): string {
  const bytes = new Uint8Array(2 + publicKey.length);
  varint.encode(ed25519_pub, bytes, 0);
  bytes.set(publicKey, varint.encode.bytes);
  return toMultibaseB58(bytes);
}

/**
 * Encodes an X25519 public key with multicodec prefix for Multikey format.
 * @param publicKey - The X25519 public key bytes.
 * @returns The multibase base58btc encoded Multikey string.
 */
export function toMultikeyX25519(publicKey: Uint8Array): string {
  const bytes = new Uint8Array(2 + publicKey.length);
  varint.encode(x25519_pub, bytes, 0);
  bytes.set(publicKey, varint.encode.bytes);
  return toMultibaseB58(bytes);
}
