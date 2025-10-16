// DIDComm message encryption/decryption service for browser
import { Message } from 'didcomm'
import { getMobileDID } from './mobileStorage'
import * as peer4 from '../lib/peer4'

// DID Resolver for client-side
class ClientDIDResolver {
  private knownDIDs: Map<string, any> = new Map()

  constructor() {}

  addDID(did: string, didDocument: any) {
    this.knownDIDs.set(did, didDocument)
  }

  async resolve(did: string): Promise<any> {
    console.log('Resolving DID:', did)

    // Check if we have it locally
    if (this.knownDIDs.has(did)) {
      return this.knownDIDs.get(did)
    }

    // For did:key, resolve locally
    if (did.startsWith('did:key:')) {
      return this.resolveDIDKey(did)
    }

    // For did:peer:4, try to decode long-form
    if (did.startsWith('did:peer:4')) {
      try {
        if (peer4.LONG_RE.test(did)) {
          return await peer4.resolve(did)
        } else {
          console.warn('Cannot resolve short-form did:peer:4 without document')
          return null
        }
      } catch (error) {
        console.error('Error resolving did:peer:', error)
        return null
      }
    }

    console.warn('Unable to resolve DID:', did)
    return null
  }

  // Simple did:key resolver for X25519 and Ed25519
  resolveDIDKey(did: string): any {
    const keyId = did.replace('did:key:', '')

    // Determine key type based on multicodec prefix
    // z6Mk = Ed25519 (0xed01)
    // z6LS = X25519 (0xec01)
    const isEd25519 = keyId.startsWith('z6Mk')
    const isX25519 = keyId.startsWith('z6LS')

    if (isEd25519) {
      // Ed25519 verification key
      // Note: In a full implementation, we should derive the X25519 key from Ed25519
      // For now, we'll create a document with both verification and key agreement capabilities
      const didDocument = {
        '@context': [
          'https://www.w3.org/ns/did/v1',
          'https://w3id.org/security/suites/ed25519-2020/v1',
          'https://w3id.org/security/suites/x25519-2020/v1'
        ],
        id: did,
        verificationMethod: [
          {
            id: `${did}#${keyId}`,
            type: 'Ed25519VerificationKey2020',
            controller: did,
            publicKeyMultibase: keyId
          }
        ],
        authentication: [`${did}#${keyId}`],
        assertionMethod: [`${did}#${keyId}`],
        capabilityDelegation: [`${did}#${keyId}`],
        capabilityInvocation: [`${did}#${keyId}`],
        keyAgreement: [`${did}#${keyId}`],
        service: []
      }
      return didDocument
    } else if (isX25519) {
      // X25519 key agreement key
      const didDocument = {
        '@context': [
          'https://www.w3.org/ns/did/v1',
          'https://w3id.org/security/suites/x25519-2020/v1'
        ],
        id: did,
        verificationMethod: [
          {
            id: `${did}#${keyId}`,
            type: 'X25519KeyAgreementKey2020',
            controller: did,
            publicKeyMultibase: keyId
          }
        ],
        authentication: [],
        keyAgreement: [`${did}#${keyId}`],
        service: []
      }
      return didDocument
    } else {
      // Default to Ed25519 for unknown types
      const didDocument = {
        '@context': [
          'https://www.w3.org/ns/did/v1',
          'https://w3id.org/security/suites/ed25519-2020/v1'
        ],
        id: did,
        verificationMethod: [
          {
            id: `${did}#${keyId}`,
            type: 'Ed25519VerificationKey2020',
            controller: did,
            publicKeyMultibase: keyId
          }
        ],
        authentication: [`${did}#${keyId}`],
        service: []
      }
      return didDocument
    }
  }
}

// Secrets Resolver for client-side
class ClientSecretsResolver {
  private secrets: Map<string, any> = new Map()

  constructor() {
    // Load mobile DID keys
    this.loadMobileKeys()
  }

  loadMobileKeys() {
    const mobileDID = getMobileDID()
    if (!mobileDID || !mobileDID.privateKeys) {
      console.warn('No mobile DID keys found')
      return
    }

    // Add all private keys from mobile DID
    for (const [keyId, keyData] of Object.entries(mobileDID.privateKeys)) {
      const fullKeyId = `${mobileDID.did}${keyData.id}`
      this.secrets.set(fullKeyId, {
        id: fullKeyId,
        type: keyData.type,
        privateKeyMultibase: keyData.publicKeyMultibase, // Note: This should be private key
        privateKeyBytes: keyData.privateKeyBytes
      })
      console.log('Loaded secret key:', fullKeyId)
    }
  }

  addSecret(keyId: string, secret: any) {
    this.secrets.set(keyId, secret)
  }

  async get_secret(keyId: string): Promise<any> {
    console.log('Retrieving secret for key:', keyId)
    const secret = this.secrets.get(keyId)

    if (!secret) {
      console.warn('Secret not found for key:', keyId)
      return null
    }

    return secret
  }
}

// Create global instances
const didResolver = new ClientDIDResolver()
const secretsResolver = new ClientSecretsResolver()

// Add a DID document to the resolver
export function addKnownDID(did: string, didDocument: any) {
  didResolver.addDID(did, didDocument)
}

// Pack (encrypt) a DIDComm message
export async function packMessage(
  plainMessage: any,
  to: string,
  from?: string,
  signFrom?: string
): Promise<string> {
  try {
    console.log('Packing DIDComm message...')
    console.log('To:', to)
    console.log('From:', from)

    // Get the mobile DID if from is not specified
    if (!from) {
      const mobileDID = getMobileDID()
      if (!mobileDID) {
        throw new Error('No mobile DID found')
      }
      from = mobileDID.did
    }

    // Ensure the recipient DID is known
    const recipientDoc = await didResolver.resolve(to)
    if (!recipientDoc) {
      throw new Error(`Cannot resolve recipient DID: ${to}`)
    }

    // Create Message instance
    const msg = new Message(plainMessage)

    console.log('Encrypting message to:', to)

    // Pack encrypted message
    const [packedMessage, metadata] = await msg.pack_encrypted(
      to,
      from,
      signFrom || null,
      didResolver,
      secretsResolver,
      {
        forward: false
      }
    )

    console.log('Message packed successfully')
    console.log('Metadata:', metadata)

    return packedMessage
  } catch (error) {
    console.error('Error packing message:', error)
    throw new Error(`Failed to pack DIDComm message: ${error.message || error}`)
  }
}

// Unpack (decrypt) a DIDComm message
export async function unpackMessage(
  packedMessage: string
): Promise<{ message: any; metadata: any }> {
  try {
    console.log('Unpacking DIDComm message...')

    // Reload secrets in case keys were updated
    secretsResolver.loadMobileKeys()

    const [message, metadata] = await Message.unpack(
      packedMessage,
      didResolver,
      secretsResolver,
      {}
    )

    console.log('Message unpacked successfully')
    console.log('Metadata:', metadata)

    return {
      message: message.as_value(),
      metadata
    }
  } catch (error) {
    console.error('Error unpacking message:', error)
    throw new Error(`Failed to unpack DIDComm message: ${error.message || error}`)
  }
}

export { didResolver, secretsResolver }
