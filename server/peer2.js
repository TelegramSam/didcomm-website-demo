// did:peer:2 resolution support
import bs58 from 'bs58'
import varint from 'varint'

// Multicodec constants
const ed25519_pub = 0xed
const x25519_pub = 0xec

// Decode multibase base58btc (starts with 'z')
function fromMultibaseB58(multibaseString) {
  if (!multibaseString.startsWith('z')) {
    throw new Error('Only base58btc multibase (z prefix) is supported')
  }
  return bs58.decode(multibaseString.slice(1))
}

// Decode a key element (Vz... or Ez...)
function decodeKey(element, did) {
  const purpose = element[0]
  const encodedKey = element.slice(1)

  const keyBytes = fromMultibaseB58(encodedKey)
  const multicodec = varint.decode(keyBytes)
  const publicKeyBytes = keyBytes.slice(varint.decode.bytes)

  // Reconstruct the multibase format for the key
  const publicKeyMultibase = encodedKey

  let type
  if (multicodec === ed25519_pub) {
    type = 'Ed25519VerificationKey2020'
  } else if (multicodec === x25519_pub) {
    type = 'X25519KeyAgreementKey2020'
  } else {
    type = 'Multikey'
  }

  // Generate key ID based on the encoded key
  const keyId = `#${encodedKey.slice(0, 8)}`

  const verificationMethod = {
    id: `${did}${keyId}`,
    type: type,
    controller: did,
    publicKeyMultibase: publicKeyMultibase
  }

  return { purpose, verificationMethod, keyId }
}

// Decode a service element (S...)
function decodeService(element, did) {
  // Remove 'S' prefix and decode from base64url
  const encoded = element.slice(1)

  // Convert base64url to base64
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')

  // Decode base64
  const jsonString = Buffer.from(base64, 'base64').toString('utf8')

  // Parse the abbreviated JSON
  const abbreviated = JSON.parse(jsonString)

  // Expand abbreviated keys and normalize for didcomm-node
  const service = {
    id: `${did}#${abbreviated.t || 'service'}`,
    type: abbreviated.t === 'dm' ? 'DIDCommMessaging' : (abbreviated.t === 'did-communication' ? 'DIDCommMessaging' : abbreviated.t)
  }

  // Normalize serviceEndpoint to object format (required by didcomm-node WASM)
  if (typeof abbreviated.s === 'object' && abbreviated.s.uri) {
    service.serviceEndpoint = {
      uri: abbreviated.s.uri,
      accept: abbreviated.s.a || abbreviated.a || ['didcomm/v2'],
      routingKeys: abbreviated.s.r || abbreviated.r || []
    }
  } else if (typeof abbreviated.s === 'string') {
    service.serviceEndpoint = {
      uri: abbreviated.s,
      accept: abbreviated.a || ['didcomm/v2'],
      routingKeys: abbreviated.r || []
    }
  }

  // Add recipient keys if present
  if (abbreviated.recipientKeys) {
    service.recipientKeys = abbreviated.recipientKeys
  }

  return service
}

// Resolve a did:peer:2
export function resolve(did) {
  if (!did.startsWith('did:peer:2')) {
    throw new Error('Not a did:peer:2')
  }

  // Split by periods, skip the first element (did:peer:2)
  const elements = did.split('.')
  if (elements.length < 2) {
    throw new Error('Invalid did:peer:2 format')
  }

  // First element is "did:peer:2"
  const didPrefix = elements[0]

  const verificationMethods = []
  const authentication = []
  const keyAgreement = []
  const services = []

  // Process each element
  for (let i = 1; i < elements.length; i++) {
    const element = elements[i]

    if (element.startsWith('V')) {
      // Verification key (authentication)
      const { verificationMethod, keyId } = decodeKey(element, did)
      verificationMethods.push(verificationMethod)
      authentication.push(verificationMethod.id)
    } else if (element.startsWith('E')) {
      // Encryption key (keyAgreement)
      const { verificationMethod, keyId } = decodeKey(element, did)
      verificationMethods.push(verificationMethod)
      keyAgreement.push(verificationMethod.id)
    } else if (element.startsWith('S')) {
      // Service
      const service = decodeService(element, did)
      services.push(service)
    }
  }

  const didDocument = {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/multikey/v1'
    ],
    id: did,
    verificationMethod: verificationMethods,
    authentication: authentication,
    keyAgreement: keyAgreement,
    service: services
  }

  return didDocument
}
