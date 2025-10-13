// DIDComm message handling with decryption support
import { Message } from 'didcomm-node'
import { generateKeyPairFromSeed } from '@stablelib/x25519'
import bs58 from 'bs58'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Storage file for server DID and keys
const SERVER_DID_FILE = path.join(__dirname, 'server-did.json')

// Generate a did:key for the server
function generateServerDID() {
  // Generate X25519 key pair for encryption
  const seed = crypto.randomBytes(32)
  const keyPair = generateKeyPairFromSeed(seed)

  // Create multibase encoding (z = base58btc)
  const publicKeyMultibase = 'z' + bs58.encode(keyPair.publicKey)

  // Create did:key format
  const did = `did:key:${publicKeyMultibase}`

  // Create DID Document
  const didDocument = {
    '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/suites/x25519-2020/v1'],
    id: did,
    verificationMethod: [
      {
        id: `${did}#${publicKeyMultibase}`,
        type: 'X25519KeyAgreementKey2020',
        controller: did,
        publicKeyMultibase: publicKeyMultibase
      }
    ],
    keyAgreement: [`${did}#${publicKeyMultibase}`]
  }

  // Store private key securely
  const serverData = {
    did,
    didDocument,
    privateKey: Array.from(keyPair.secretKey), // Store as array for JSON
    publicKey: Array.from(keyPair.publicKey),
    createdAt: new Date().toISOString()
  }

  return serverData
}

// Load or create server DID
function getServerDID() {
  if (fs.existsSync(SERVER_DID_FILE)) {
    const data = JSON.parse(fs.readFileSync(SERVER_DID_FILE, 'utf8'))
    console.log('Loaded existing server DID:', data.did)
    return data
  }

  console.log('Generating new server DID...')
  const serverData = generateServerDID()
  fs.writeFileSync(SERVER_DID_FILE, JSON.stringify(serverData, null, 2))
  console.log('Created new server DID:', serverData.did)
  return serverData
}

// Initialize server DID
const SERVER_DID_DATA = getServerDID()

// DID Resolver implementation
class ServerDIDResolver {
  constructor(knownDIDs = {}) {
    this.knownDIDs = knownDIDs
    // Add server DID
    this.knownDIDs[SERVER_DID_DATA.did] = SERVER_DID_DATA.didDocument
  }

  // Add a DID document to the resolver
  addDID(did, didDocument) {
    this.knownDIDs[did] = didDocument
  }

  // Resolve a DID to its DID Document
  async resolve(did) {
    console.log('Resolving DID:', did)

    // Check if we have it locally
    if (this.knownDIDs[did]) {
      return this.knownDIDs[did]
    }

    // For did:key, we can resolve it locally
    if (did.startsWith('did:key:')) {
      return this.resolveDIDKey(did)
    }

    // For did:peer, we need the full long-form DID
    if (did.startsWith('did:peer:')) {
      // Attempt to parse if it's a long-form did:peer
      // This is a simplified implementation
      console.warn('did:peer resolution requires long-form DID or pre-registered document')
      return null
    }

    console.warn('Unable to resolve DID:', did)
    return null
  }

  // Simple did:key resolver (supports X25519 only for now)
  resolveDIDKey(did) {
    const keyId = did.replace('did:key:', '')

    // Remove multibase prefix 'z' and decode
    const publicKeyBytes = bs58.decode(keyId.substring(1))

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
      keyAgreement: [`${did}#${keyId}`]
    }

    return didDocument
  }
}

// Secrets Resolver implementation
class ServerSecretsResolver {
  constructor() {
    this.secrets = new Map()

    // Add server's private key
    const publicKeyBytes = new Uint8Array(SERVER_DID_DATA.publicKey)
    const privateKeyBytes = new Uint8Array(SERVER_DID_DATA.privateKey)
    const publicKeyMultibase = 'z' + bs58.encode(publicKeyBytes)
    const privateKeyMultibase = 'z' + bs58.encode(privateKeyBytes)
    const keyId = `${SERVER_DID_DATA.did}#${publicKeyMultibase}`

    this.secrets.set(keyId, {
      id: keyId,
      type: 'X25519KeyAgreementKey2020',
      privateKeyMultibase: privateKeyMultibase
    })

    console.log('Initialized secrets resolver with key:', keyId)
  }

  // Add a secret key
  addSecret(keyId, privateKeyMultibase) {
    this.secrets.set(keyId, {
      id: keyId,
      type: 'X25519KeyAgreementKey2020',
      privateKeyMultibase
    })
  }

  // Get secret by key ID
  async getSecret(keyId) {
    console.log('Retrieving secret for key:', keyId)
    const secret = this.secrets.get(keyId)

    if (!secret) {
      console.warn('Secret not found for key:', keyId)
      return null
    }

    return secret
  }

  // Get all secret key IDs
  async getSecretKeyIds() {
    return Array.from(this.secrets.keys())
  }
}

// Create global instances
const didResolver = new ServerDIDResolver()
const secretsResolver = new ServerSecretsResolver()

// Unpack (decrypt) a DIDComm message
async function unpackMessage(packedMessage) {
  try {
    console.log('Attempting to unpack message...')
    console.log('Message type:', typeof packedMessage)

    // If message is an object, it might already be plaintext
    if (typeof packedMessage === 'object' && packedMessage.type && !packedMessage.ciphertext) {
      console.log('Message appears to be plaintext DIDComm')
      return {
        message: packedMessage,
        metadata: {
          encrypted: false,
          authenticated: false,
          anonymous_sender: false
        }
      }
    }

    // Convert to string if needed
    const messageStr =
      typeof packedMessage === 'string' ? packedMessage : JSON.stringify(packedMessage)

    // Unpack the encrypted message
    const result = await Message.unpack(messageStr, didResolver, secretsResolver, {})

    console.log('Message unpacked successfully')

    return {
      message: result[0].as_value(),
      metadata: result[1]
    }
  } catch (error) {
    console.error('Error unpacking message:', error)
    throw new Error(`Failed to unpack DIDComm message: ${error.message}`)
  }
}

// Pack (encrypt) a DIDComm message
async function packMessage(message, to, from = SERVER_DID_DATA.did, signFrom = null) {
  try {
    console.log('Packing message...')

    // Create Message instance
    const msg = new Message(message)

    // Pack encrypted message
    const result = await msg.pack_encrypted(to, from, signFrom, didResolver, secretsResolver, {
      forward: false
    })

    console.log('Message packed successfully')

    return {
      message: result[0],
      metadata: result[1]
    }
  } catch (error) {
    console.error('Error packing message:', error)
    throw new Error(`Failed to pack DIDComm message: ${error.message}`)
  }
}

export {
  SERVER_DID_DATA,
  didResolver,
  secretsResolver,
  unpackMessage,
  packMessage,
  ServerDIDResolver,
  ServerSecretsResolver
}
