// Server-side did:peer:4 implementation
import bs58 from 'bs58'
import varint from 'varint'
import { sha256 } from '@noble/hashes/sha2.js'

// Multibase constants
const base58btc = 'z'

// Multicodec constants
const json = 0x0200
const ed25519_pub = 0xed
const x25519_pub = 0xec
const ed25519_priv = 0x1300
const x25519_priv = 0x1302

// Multihash constants
const sha2_256 = 0x12
const sha2_bytes_256 = 0x20

/**
 * Encodes a byte array into a multibase base58btc string.
 */
export function toMultibaseB58(input) {
  const encoded = bs58.encode(input)
  return `${base58btc}${encoded}`
}

/**
 * Encodes an Ed25519 public key with multicodec prefix for Multikey format.
 */
export function toMultikeyEd25519(publicKey) {
  const bytes = new Uint8Array(2 + publicKey.length)
  varint.encode(ed25519_pub, bytes, 0)
  bytes.set(publicKey, varint.encode.bytes)
  return toMultibaseB58(bytes)
}

/**
 * Encodes an X25519 public key with multicodec prefix for Multikey format.
 */
export function toMultikeyX25519(publicKey) {
  const bytes = new Uint8Array(2 + publicKey.length)
  varint.encode(x25519_pub, bytes, 0)
  bytes.set(publicKey, varint.encode.bytes)
  return toMultibaseB58(bytes)
}

/**
 * Encodes an Ed25519 private key with multicodec prefix.
 */
export function toMultikeyEd25519Private(privateKey, publicKey) {
  // For Ed25519, concatenate private key (32 bytes) + public key (32 bytes) = 64 bytes
  const combined = new Uint8Array(privateKey.length + publicKey.length)
  combined.set(privateKey, 0)
  combined.set(publicKey, privateKey.length)

  // Calculate varint size for ed25519_priv (0x1300)
  const varintSize = varint.encodingLength(ed25519_priv)
  const bytes = new Uint8Array(varintSize + combined.length)
  varint.encode(ed25519_priv, bytes, 0)
  bytes.set(combined, varint.encode.bytes)
  return toMultibaseB58(bytes)
}

/**
 * Encodes an X25519 private key with multicodec prefix.
 */
export function toMultikeyX25519Private(privateKey) {
  // Calculate varint size for x25519_priv (0x1302)
  const varintSize = varint.encodingLength(x25519_priv)
  const bytes = new Uint8Array(varintSize + privateKey.length)
  varint.encode(x25519_priv, bytes, 0)
  bytes.set(privateKey, varint.encode.bytes)
  return toMultibaseB58(bytes)
}

/**
 * Decodes a multibase base58btc string into a byte array.
 */
export function fromMultibaseB58(input) {
  const decoded = bs58.decode(input.slice(1))
  return decoded
}

/**
 * Hashes a byte array using SHA-256 and returns it as a multihash.
 */
export function multihashSha256(input) {
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
 */
export function toMulticodecJson(input) {
  const encoded = new TextEncoder().encode(JSON.stringify(input))
  const bytes = new Uint8Array(2 + encoded.length)
  varint.encode(json, bytes, 0)
  bytes.set(encoded, 2)
  return bytes
}

/**
 * Decodes a multicodec JSON byte array into a JSON document.
 */
export function fromMulticodecJson(input) {
  const decoded = new TextDecoder().decode(input.slice(2))
  return JSON.parse(decoded)
}

/**
 * Encodes a DID document into a long-form did:peer:4 string.
 */
export function encode(inputDocument) {
  const encodedDocument = encodeDocument(inputDocument)
  const hash = hashDocument(encodedDocument)
  const longForm = `did:peer:4${hash}:${encodedDocument}`
  return longForm
}

/**
 * Resolves a long-form did:peer:4 string into a DID document.
 * By default, uses the short form as the document ID.
 * Set preserveLongForm to true to keep the long form as the ID.
 */
export function resolve(longFormDid, preserveLongForm = false) {
  const parts = longFormDid.split(':')
  if (parts.length < 4 || parts[0] !== 'did' || parts[1] !== 'peer' || !parts[2].startsWith('4')) {
    throw new Error('Invalid did:peer:4 format')
  }

  const encodedDoc = parts.slice(3).join(':')
  const document = decodeDocument(encodedDoc)

  const shortForm = `${parts[0]}:${parts[1]}:${parts[2]}`
  document.id = preserveLongForm ? longFormDid : shortForm

  // Add alsoKnownAs with the other form
  if (!document.alsoKnownAs) {
    document.alsoKnownAs = []
  }
  document.alsoKnownAs.push(preserveLongForm ? shortForm : longFormDid)

  // Contextualize the document
  return contextualizeDocument(document)
}

// Helper functions

function encodeDocument(inputDocument) {
  const doc = { ...inputDocument }
  delete doc.id
  const encoded = toMulticodecJson(doc)
  return toMultibaseB58(encoded)
}

function decodeDocument(encodedDocument) {
  const decoded = fromMultibaseB58(encodedDocument)
  return fromMulticodecJson(decoded)
}

function hashDocument(encodedDocument) {
  const bytes = new TextEncoder().encode(encodedDocument)
  const multihashed = multihashSha256(bytes)
  return toMultibaseB58(multihashed)
}

function contextualizeDocument(doc) {
  const id = doc.id

  // Contextualize verificationMethod
  if (doc.verificationMethod) {
    doc.verificationMethod = doc.verificationMethod.map(vm => {
      const contextualizedVm = {
        ...vm,
        id: vm.id.startsWith('#') ? `${id}${vm.id}` : vm.id,
        controller: id
      }

      // Convert Multikey to specific types for didcomm-node compatibility
      if (vm.type === 'Multikey' && vm.publicKeyMultibase) {
        const keyBytes = fromMultibaseB58(vm.publicKeyMultibase)
        const multicodec = varint.decode(keyBytes)

        // Determine specific type based on multicodec prefix
        if (multicodec === ed25519_pub) {
          contextualizedVm.type = 'Ed25519VerificationKey2020'
        } else if (multicodec === x25519_pub) {
          contextualizedVm.type = 'X25519KeyAgreementKey2020'
        }
      }

      return contextualizedVm
    })
  }

  // Contextualize authentication references
  if (doc.authentication) {
    doc.authentication = doc.authentication.map(ref =>
      typeof ref === 'string' && ref.startsWith('#') ? `${id}${ref}` : ref
    )
  }

  // Contextualize keyAgreement references
  if (doc.keyAgreement) {
    doc.keyAgreement = doc.keyAgreement.map(ref =>
      typeof ref === 'string' && ref.startsWith('#') ? `${id}${ref}` : ref
    )
  }

  return doc
}
