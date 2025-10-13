/**
 * did:peer:4 implementation
 *
 * This module provides functionality for creating and resolving did:peer:4 DIDs,
 * which are self-certifying decentralized identifiers that embed their DID document
 * in the identifier itself.
 *
 * Basic usage:
 * - Use `encode()` to create a long-form DID from a DID document
 * - Use `encodeShort()` to create a short-form DID (hash only)
 * - Use `resolve()` to extract the DID document from a long-form DID
 * - Use `decode()` to verify and extract the document without contextualization
 *
 * Long-form DIDs contain the full document: did:peer:4{hash}:{encoded-document}
 * Short-form DIDs contain only the hash: did:peer:4{hash}
 *
 * @see https://identity.foundation/peer-did-method-spec/
 */

import {
  toMultibaseB58,
  fromMultibaseB58,
  multihashSha256,
  toMulticodecJson,
  fromMulticodecJson
} from './multiformats'

type Document = Record<string, any>

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

// Public API

export const LONG_RE = new RegExp(`^did:peer:4zQm[${B58}]{44}:z[${B58}]{6,}$`)
export const SHORT_RE = new RegExp(`^did:peer:4zQm[${B58}]{44}$`)

/**
 * Encodes a DID document into a long-form did:peer:4 string.
 * @param inputDocument - The DID document to encode.
 * @returns The long-form did:peer:4 string.
 */
export function encode(inputDocument: Document): string {
  const encodedDocument = encodeDocument(inputDocument)
  const hash = hashDocument(encodedDocument)

  const longForm = `did:peer:4${hash}:${encodedDocument}`

  return longForm
}

/**
 * Encodes a DID document into a short-form did:peer:4 string.
 * @param inputDocument - The DID document to encode.
 * @returns The short-form did:peer:4 string.
 */
export function encodeShort(inputDocument: Document): string {
  const encodedDocument = encodeDocument(inputDocument)
  const hash = hashDocument(encodedDocument)

  const shortForm = `did:peer:4${hash}`

  return shortForm
}

/**
 * Converts a long-form did:peer:4 string to a short-form did:peer:4 string.
 * @param did - The long-form did:peer:4 string.
 * @returns The short-form did:peer:4 string.
 * @throws If the DID is not a long-form did:peer:4.
 */
export function longToShort(did: string): string {
  if (!LONG_RE.test(did)) {
    throw new Error('DID is not a long form did:peer:4')
  }

  return did.slice(0, did.lastIndexOf(':'))
}

/**
 * Resolves a long-form did:peer:4 string to a DID document.
 * @param did - The long-form did:peer:4 string.
 * @returns The DID document.
 */
export function resolve(did: string): Document {
  const decodedDocument = decode(did)
  const document = contextualizeDocument(did, decodedDocument)
  document.alsoKnownAs = document.alsoKnownAs || []
  document.alsoKnownAs.push(longToShort(did))
  return document
}

/**
 * Resolves a long-form did:peer:4 string to a DID document, but returns the short-form context.
 * @param did - The long-form did:peer:4 string.
 * @returns The DID document.
 */
export function resolveShort(did: string): Document {
  const decodedDocument = decode(did)
  const shortForm = longToShort(did)
  const document = contextualizeDocument(shortForm, decodedDocument)
  document.alsoKnownAs = document.alsoKnownAs || []
  document.alsoKnownAs.push(did)
  return document
}

/**
 * Resolves a short-form did:peer:4 from a DID document.
 * @param document - The DID document.
 * @param did - The short-form did:peer:4 string to validate against.
 * @returns The DID document.
 * @throws If the provided DID does not match the calculated short-form DID.
 */
export function resolveShortFromDoc(document: Document, did: string | null): Document {
  const longForm = encode(document)
  if (did !== null) {
    const shortForm = longToShort(longForm)
    if (did !== shortForm) {
      throw new Error(`DID mismatch: ${did} !== ${shortForm}`)
    }
  }
  return resolveShort(longForm)
}

/**
 * Decodes a long-form did:peer:4 string to a DID document.
 * @param did - The long-form did:peer:4 string.
 * @returns The DID document.
 * @throws If the DID is invalid or the hash is invalid.
 */
export function decode(did: string): Document {
  if (!did.startsWith('did:peer:4')) {
    throw new Error('Invalid did:peer:4')
  }

  if (SHORT_RE.test(did)) {
    throw new Error('Cannot decode document form short form did:peer:4')
  }

  if (!LONG_RE.test(did)) {
    throw new Error('Invalid did:peer:4')
  }

  const [hash, doc] = did.slice(10).split(':')
  if (hash !== hashDocument(doc)) {
    throw new Error(`Hash is invalid for did: ${did}`)
  }

  const decoded = fromMulticodecJson(fromMultibaseB58(doc))
  return decoded
}

// Internal helpers

/**
 * Encodes a DID document into a multibase base58btc string.
 * @param document - The DID document to encode.
 * @returns The multibase base58btc encoded string.
 */
function encodeDocument(document: Document): string {
  const encoded = toMultibaseB58(toMulticodecJson(document))
  return encoded
}

/**
 * Hashes an encoded DID document.
 * @param encodedDocument - The encoded DID document.
 * @returns The multibase base58btc encoded hash.
 */
function hashDocument(encodedDocument: string): string {
  const bytes = new TextEncoder().encode(encodedDocument)
  const multihashed = multihashSha256(bytes)
  return toMultibaseB58(multihashed)
}

/**
 * A higher-order function that returns a curried function to operate on an embedded document.
 * @param callback - The function to apply to the document.
 * @returns A function that can operate on a document or a string.
 */
function operateOnEmbedded(
  callback: (document: Document) => Document
): (document: Document | string) => Document | string {
  function _curried(document: Document | string): Document | string {
    if (typeof document === 'string') {
      return document
    } else {
      return callback(document)
    }
  }
  return _curried
}

/**
 * Visits all verification methods in a DID document and applies a callback.
 * @param document - The DID document.
 * @param callback - The function to apply to each verification method.
 * @returns The modified DID document.
 */
function visitVerificationMethods(document: Document, callback: (document: Document) => Document) {
  document.verificationMethod = document.verificationMethod?.map(callback)
  document.authentication = document.authentication?.map(operateOnEmbedded(callback))
  document.assertionMethod = document.assertionMethod?.map(operateOnEmbedded(callback))
  document.keyAgreement = document.keyAgreement?.map(operateOnEmbedded(callback))
  document.capabilityDelegation = document.capabilityDelegation?.map(operateOnEmbedded(callback))
  document.capabilityInvocation = document.capabilityInvocation?.map(operateOnEmbedded(callback))
  return document
}

/**
 * Contextualizes a DID document by adding the DID to the document and its verification methods.
 * @param did - The DID.
 * @param document - The DID document.
 * @returns The contextualized DID document.
 */
function contextualizeDocument(did: string, document: Document): Document {
  const contextualized = { ...document }
  contextualized.id = did

  visitVerificationMethods(contextualized, vm => {
    if (vm.controller === undefined) {
      vm.controller = did
    }
    return vm
  })

  return contextualized
}
