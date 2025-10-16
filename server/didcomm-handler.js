// DIDComm message handling with decryption support
import { Message } from 'didcomm-node'
import { generateKeyPairFromSeed } from '@stablelib/x25519'
import * as ed from '@noble/ed25519'
import bs58 from 'bs58'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import * as peer4 from './peer4.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Storage file for server DID and keys
const SERVER_DID_FILE = path.join(__dirname, 'server-did.json')

// Generate a did:peer:4 for the server
async function generateServerDID() {
  // Generate Ed25519 key pair for authentication
  const authPrivateKey = ed.utils.randomPrivateKey()
  const authPublicKey = await ed.getPublicKeyAsync(authPrivateKey)

  // Generate X25519 key pair for encryption
  const encSeed = crypto.randomBytes(32)
  const encKeyPair = generateKeyPairFromSeed(encSeed)

  // Create DID Document (without id, it will be added during resolution)
  const didDocument = {
    verificationMethod: [
      {
        id: '#key-1',
        type: 'Multikey',
        publicKeyMultibase: peer4.toMultikeyEd25519(authPublicKey)
      },
      {
        id: '#key-2',
        type: 'Multikey',
        publicKeyMultibase: peer4.toMultikeyX25519(encKeyPair.publicKey)
      }
    ],
    authentication: ['#key-1'],
    keyAgreement: ['#key-2'],
    service: [
      {
        id: '#service',
        type: 'DIDCommMessaging',
        serviceEndpoint: {
          uri: 'http://localhost:3000/didcomm',
          accept: ['didcomm/v2'],
          routingKeys: []
        }
      }
    ]
  }

  // Generate the long-form did:peer:4
  const longFormDid = peer4.encode(didDocument)

  // Resolve to get the full DID document with id
  const resolvedDocument = peer4.resolve(longFormDid)

  // Store private keys
  const privateKeys = {
    'key-1': {
      id: '#key-1',
      type: 'Multikey',
      publicKeyMultibase: peer4.toMultikeyEd25519(authPublicKey),
      privateKeyBytes: Array.from(authPrivateKey)
    },
    'key-2': {
      id: '#key-2',
      type: 'Multikey',
      publicKeyMultibase: peer4.toMultikeyX25519(encKeyPair.publicKey),
      privateKeyBytes: Array.from(encKeyPair.secretKey)
    }
  }

  const serverData = {
    did: longFormDid,
    didDocument: resolvedDocument,
    privateKeys: privateKeys,
    createdAt: new Date().toISOString()
  }

  return serverData
}

// Load or create server DID
async function getServerDID() {
  // TEMPORARY: Always regenerate DID on boot for testing
  // TODO: Remove this block to restore normal behavior (load existing DID)
  // START TEMPORARY CODE - REVERT THIS
  console.log('Generating new server DID (TEMPORARY: regenerating on every boot)...')
  const serverData = await generateServerDID()
  fs.writeFileSync(SERVER_DID_FILE, JSON.stringify(serverData, null, 2))
  console.log('Created new server DID:', serverData.did)
  return serverData
  // END TEMPORARY CODE - REVERT THIS

  // ORIGINAL CODE (commented out temporarily):
  // if (fs.existsSync(SERVER_DID_FILE)) {
  //   const data = JSON.parse(fs.readFileSync(SERVER_DID_FILE, 'utf8'))
  //   console.log('Loaded existing server DID:', data.did)
  //   return data
  // }
  //
  // console.log('Generating new server DID...')
  // const serverData = await generateServerDID()
  // fs.writeFileSync(SERVER_DID_FILE, JSON.stringify(serverData, null, 2))
  // console.log('Created new server DID:', serverData.did)
  // return serverData
}

// Initialize server DID
const SERVER_DID_DATA = await getServerDID()

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

    // For did:peer:4, resolve from long-form DID
    if (did.startsWith('did:peer:4') && did.includes(':z')) {
      try {
        return peer4.resolve(did)
      } catch (error) {
        console.error('Failed to resolve did:peer:4:', error)
        return null
      }
    }

    // For other did:peer, we need pre-registered document
    if (did.startsWith('did:peer:')) {
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

    // Add server's private keys from the new format
    if (SERVER_DID_DATA.privateKeys) {
      for (const [keyName, keyData] of Object.entries(SERVER_DID_DATA.privateKeys)) {
        const privateKeyBytes = new Uint8Array(keyData.privateKeyBytes)
        const privateKeyMultibase = peer4.toMultibaseB58(privateKeyBytes)
        const keyId = `${SERVER_DID_DATA.did}${keyData.id}`

        this.secrets.set(keyId, {
          id: keyId,
          type: keyData.type,
          privateKeyMultibase: privateKeyMultibase
        })

        console.log('Initialized secrets resolver with key:', keyId)
      }
    }
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
