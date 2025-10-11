import bs58 from 'bs58'
import * as varint from 'varint'
import { sha256 } from '@noble/hashes/sha2.js'

type Document = Record<string, any>

// Multibase constants
const base58btc = 'z'

// Multicodec constants
const json = 0x0200

// Multihash constants
const sha2_256 = 0x12
const sha2_bytes_256 = 0x20

/**
 * Encodes a byte array into a multibase base58btc string.
 * @param input - The byte array to encode.
 * @returns The multibase base58btc encoded string.
 */
export function toMultibaseB58(input: Uint8Array): string {
  const encoded = bs58.encode(input)
  return `${base58btc}${encoded}`
}

/**
 * Decodes a multibase base58btc string into a byte array.
 * @param input - The multibase base58btc encoded string.
 * @returns The decoded byte array.
 */
export function fromMultibaseB58(input: string): Uint8Array {
  const decoded = bs58.decode(input.slice(1))
  return decoded
}

/**
 * Hashes a byte array using SHA-256 and returns it as a multihash.
 * @param input - The byte array to hash.
 * @returns The multihash byte array.
 */
export function multihashSha256(input: Uint8Array): Uint8Array {
  const mh = new Uint8Array(2)
  const digest = sha256(input)
  varint.encode(sha2_256, mh, 0)
  varint.encode(sha2_bytes_256, mh, 1)
  const output = new Uint8Array(mh.length + digest.length)
  output.set(mh)
  output.set(digest, mh.length)
  return output
}

/**
 * Encodes a JSON document into a multicodec JSON byte array.
 * @param input - The JSON document to encode.
 * @returns The multicodec JSON encoded byte array.
 */
export function toMulticodecJson(input: Document): Uint8Array {
  const encoded = new TextEncoder().encode(JSON.stringify(input))
  const bytes = new Uint8Array(2 + encoded.length)
  varint.encode(json, bytes, 0)
  bytes.set(encoded, 2)
  return bytes
}

/**
 * Decodes a multicodec JSON byte array into a JSON document.
 * @param input - The multicodec JSON encoded byte array.
 * @returns The decoded JSON document.
 */
export function fromMulticodecJson(input: Uint8Array): Document {
  const decoded = new TextDecoder().decode(input.slice(2))
  return JSON.parse(decoded)
}
