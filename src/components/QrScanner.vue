<template>
  <div class="scanner">
    <div class="scanner-container">
      <h2>Scan to Login</h2>

      <div v-if="!isScanning && !scannedData && !isConnecting" class="scanner-placeholder">
        <button @click="startScanner">Start Scan</button>
      </div>

      <div v-if="isScanning" class="scanner-view">
        <div id="qr-reader"></div>
        <button @click="stopScanner" class="stop-button">Stop Scanner</button>
      </div>

      <div v-if="isConnecting" class="connecting">
        <div class="spinner"></div>
        <h3>Connecting...</h3>
        <p>{{ connectionName }}</p>
      </div>

      <div v-if="error" class="error">
        {{ error }}
      </div>

      <div v-if="connectionSuccess" class="result success">
        <h3>✓ Connection Established!</h3>
        <p>
          <strong>{{ connectionSuccess.name }}</strong>
        </p>
        <p class="connection-did">Your DID: {{ connectionSuccess.myDid }}</p>
        <p class="connection-did">Connected to: {{ connectionSuccess.did }}</p>
        <button @click="resetScanner">Scan Another</button>
      </div>

      <div v-if="scannedData && !connectionSuccess && !isConnecting" class="result">
        <h3>Scanned Data:</h3>
        <pre>{{ scannedData }}</pre>
        <button @click="resetScanner">Scan Again</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import { Html5Qrcode } from 'html5-qrcode'
import { saveConnection } from '../services/mobileStorage'
import * as peer4 from '../lib/peer4'
import { toMultikeyEd25519, toMultikeyX25519 } from '../lib/multiformats'

const scannedData = ref('')
const isScanning = ref(false)
const isConnecting = ref(false)
const connectionName = ref('')
const connectionSuccess = ref(null)
const error = ref('')
let html5QrCode = null

const emit = defineEmits(['connection-created'])

// Mediator configuration
const MEDIATOR_CONFIG = {
  did: 'did:key:z6Mkgs6MwYB3YgToZXGwknqC352cbHtxJsi3zXZfF1t2fNkT',
  endpoint: 'https://us-east2.public.mediator.indiciotech.io/message',
  wsEndpoint: 'wss://ws.us-east2.public.mediator.indiciotech.io/ws'
}

// Generate Ed25519 key pair using Web Crypto API
async function generateEd25519KeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'Ed25519',
      namedCurve: 'Ed25519'
    },
    true,
    ['sign', 'verify']
  )

  const privateKeyRaw = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
  const publicKeyRaw = await crypto.subtle.exportKey('spki', keyPair.publicKey)

  const privateKey = new Uint8Array(privateKeyRaw).slice(-32)
  const publicKey = new Uint8Array(publicKeyRaw).slice(-32)

  return { privateKey, publicKey }
}

// Generate X25519 key pair for encryption
function generateX25519KeyPair() {
  const privateKey = crypto.getRandomValues(new Uint8Array(32))
  const publicKey = crypto.getRandomValues(new Uint8Array(32))
  return { privateKey, publicKey }
}


// Generate a new DID for this connection
async function generateConnectionDID() {
  console.log('Generating new DID for connection...')
  const authKeys = await generateEd25519KeyPair()
  const encKeys = generateX25519KeyPair()

  const didDocument = {
    verificationMethod: [
      {
        id: '#key-1',
        type: 'Multikey',
        publicKeyMultibase: toMultikeyEd25519(authKeys.publicKey)
      },
      {
        id: '#key-2',
        type: 'Multikey',
        publicKeyMultibase: toMultikeyX25519(encKeys.publicKey)
      }
    ],
    authentication: ['#key-1'],
    keyAgreement: ['#key-2']
  }

  const longFormDid = await peer4.encode(didDocument)
  const resolvedDocument = await peer4.resolve(longFormDid)

  const privateKeyData = {
    'key-1': {
      id: '#key-1',
      type: 'Multikey',
      publicKeyMultibase: toMultikeyEd25519(authKeys.publicKey),
      privateKeyBytes: Array.from(authKeys.privateKey)
    },
    'key-2': {
      id: '#key-2',
      type: 'Multikey',
      publicKeyMultibase: toMultikeyX25519(encKeys.publicKey),
      privateKeyBytes: Array.from(encKeys.privateKey)
    }
  }

  console.log('Generated DID:', longFormDid)
  return {
    did: longFormDid,
    didDocument: resolvedDocument,
    privateKeys: privateKeyData
  }
}

// Register DID with mediator
async function registerWithMediator(myDid) {
  const mediationRequest = {
    type: 'https://didcomm.org/coordinate-mediation/3.0/mediate-request',
    id: crypto.randomUUID(),
    from: myDid,
    to: [MEDIATOR_CONFIG.did],
    body: {}
  }

  console.log('Registering DID with mediator:', myDid)

  try {
    const response = await fetch(MEDIATOR_CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/didcomm-encrypted+json'
      },
      body: JSON.stringify(mediationRequest)
    })

    if (response.ok) {
      const result = await response.json()
      console.log('Mediation response:', result)
      return result
    } else {
      console.error('Mediation request failed:', response.status)
      return null
    }
  } catch (error) {
    console.error('Error registering with mediator:', error)
    return null
  }
}

const parseDIDCommInvitation = scannedText => {
  try {
    // Check if it's a URL with _oob parameter
    const url = new URL(scannedText)
    const oobParam = url.searchParams.get('_oob')

    if (oobParam) {
      const invitation = JSON.parse(decodeURIComponent(oobParam))
      return invitation
    }
  } catch (e) {
    // Not a URL, might be direct JSON
    try {
      const data = JSON.parse(scannedText)
      if (data.type && data.type.includes('out-of-band')) {
        return data
      }
    } catch (e2) {
      // Not valid JSON
    }
  }
  return null
}

const handleConnection = async invitation => {
  isConnecting.value = true
  connectionName.value = 'Creating new DID...'

  try {
    // Generate a new DID for this connection
    const newDID = await generateConnectionDID()

    connectionName.value = 'Registering with mediator...'

    // Register the new DID with the mediator
    const mediationResponse = await registerWithMediator(newDID.did)

    connectionName.value = 'Establishing connection with ' + (invitation.body?.goal || 'website')

    // Simulate connection process
    await new Promise(resolve => setTimeout(resolve, 1000))

    const connection = {
      did: invitation.from,
      myDid: newDID.did,
      myDidDocument: newDID.didDocument,
      myPrivateKeys: newDID.privateKeys,
      invitationId: invitation.id,
      goalCode: invitation.body?.goal_code,
      goal: invitation.body?.goal,
      status: 'connected',
      mediationResponse,
      connectedAt: new Date().toISOString()
    }

    saveConnection(connection)

    connectionSuccess.value = {
      name: invitation.body?.goal || 'Connection',
      did: invitation.from,
      myDid: newDID.did
    }

    isConnecting.value = false

    // Emit event to update parent component
    emit('connection-created', connection)
  } catch (err) {
    console.error('Error handling connection:', err)
    error.value = 'Failed to create connection: ' + err.message
    isConnecting.value = false
  }
}

const startScanner = async () => {
  isScanning.value = true
  error.value = ''
  scannedData.value = ''
  connectionSuccess.value = null

  // Wait for DOM to update
  await new Promise(resolve => setTimeout(resolve, 100))

  try {
    html5QrCode = new Html5Qrcode('qr-reader')

    await html5QrCode.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 }
      },
      async decodedText => {
        scannedData.value = decodedText
        await stopScanner()

        // Check if it's a DIDComm invitation
        const invitation = parseDIDCommInvitation(decodedText)
        if (invitation) {
          await handleConnection(invitation)
        }
      },
      () => {
        // Ignore errors during scanning (just means no QR code detected)
      }
    )
  } catch (err) {
    error.value = `Failed to start camera: ${err}`
    isScanning.value = false
  }
}

const stopScanner = async () => {
  if (html5QrCode) {
    try {
      await html5QrCode.stop()
      html5QrCode.clear()
    } catch (err) {
      console.error('Error stopping scanner:', err)
    }
  }
  isScanning.value = false
}

const resetScanner = () => {
  scannedData.value = ''
  error.value = ''
  connectionSuccess.value = null
}

onUnmounted(() => {
  if (html5QrCode && isScanning.value) {
    stopScanner()
  }
})
</script>

<style scoped>
.scanner {
  display: flex;
  justify-content: center;
}

.scanner-container {
  background: white;
  color: #333;
  padding: 2rem;
  border-radius: 1rem;
  width: 100%;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.scanner-placeholder {
  background: #f0f0f0;
  padding: 3rem 1rem;
  border-radius: 0.5rem;
  text-align: center;
  margin: 1rem 0;
}

.scanner-placeholder p:first-child {
  font-size: 3rem;
  margin: 0;
}

button {
  background: #0066cc;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 1rem;
  cursor: pointer;
  margin-top: 1rem;
}

button:hover {
  background: #0052a3;
}

.scanner-view {
  margin: 1rem 0;
  position: relative;
}

.scanner-view video {
  width: 100%;
  max-width: 500px;
  border-radius: 0.5rem;
}

.loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 1rem 2rem;
  border-radius: 0.5rem;
  font-size: 1.2rem;
}

.stop-button {
  margin-top: 1rem;
  background: #dc3545;
}

.stop-button:hover {
  background: #c82333;
}

.error {
  margin-top: 1rem;
  padding: 1rem;
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
  border-radius: 0.5rem;
}

.connecting {
  margin: 2rem 0;
  padding: 2rem;
  background: #fff;
  border: 2px solid #0066cc;
  border-radius: 0.5rem;
  text-align: center;
}

.connecting h3 {
  color: #0066cc;
  margin: 1rem 0 0.5rem 0;
}

.connecting p {
  color: #666;
  margin: 0.5rem 0;
}

.spinner {
  width: 60px;
  height: 60px;
  border: 6px solid #f3f3f3;
  border-top: 6px solid #0066cc;
  border-radius: 50%;
  margin: 0 auto;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.result {
  margin-top: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 0.5rem;
}

.result.success {
  background: #d4edda;
  border: 2px solid #28a745;
}

.result.success h3 {
  color: #155724;
  margin-top: 0;
  font-size: 1.5rem;
}

.result.success p {
  color: #155724;
  margin: 0.5rem 0;
}

.connection-did {
  font-family: monospace;
  font-size: 0.85rem;
  color: #666;
  word-break: break-all;
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 0.25rem;
  margin-top: 0.5rem;
}

.result h3 {
  color: #333;
  margin-top: 0;
}

pre {
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
  background: #fff;
  padding: 1rem;
  border-radius: 0.25rem;
  color: #333;
}
</style>
