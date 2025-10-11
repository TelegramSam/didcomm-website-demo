// Indicio Public Mediator Service
import { saveMobileDID, getMobileDID, saveConnection } from './mobileStorage';
import * as peer4 from '../lib/peer4';
import bs58 from 'bs58';

// Indicio Public Mediator Configuration
const MEDIATOR_CONFIG = {
  did: 'did:key:z6Mkgs6MwYB3YgToZXGwknqC352cbHtxJsi3zXZfF1t2fNkT',
  endpoint: 'https://us-east2.public.mediator.indiciotech.io/message',
  wsEndpoint: 'wss://ws.us-east2.public.mediator.indiciotech.io/ws',
  label: 'Indicio Cloud Mediator'
};

// Generate Ed25519 key pair using Web Crypto API
async function generateEd25519KeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'Ed25519',
      namedCurve: 'Ed25519'
    } as any,
    true,
    ['sign', 'verify']
  );

  const privateKeyRaw = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  const publicKeyRaw = await crypto.subtle.exportKey('spki', keyPair.publicKey);

  // Extract the raw 32-byte keys from the exported formats
  const privateKey = new Uint8Array(privateKeyRaw).slice(-32);
  const publicKey = new Uint8Array(publicKeyRaw).slice(-32);

  return { privateKey, publicKey };
}

// Generate X25519 key pair for encryption
function generateX25519KeyPair() {
  const privateKey = crypto.getRandomValues(new Uint8Array(32));
  const publicKey = crypto.getRandomValues(new Uint8Array(32));
  return { privateKey, publicKey };
}

// Convert bytes to multibase base58btc format
function bytesToMultibase(bytes: Uint8Array): string {
  return 'z' + bs58.encode(bytes);
}

// Generate a new DID for the mobile wallet
async function generateMobileDID() {
  // Generate Ed25519 key pair for authentication
  const authKeys = await generateEd25519KeyPair();

  // Generate X25519 key pair for encryption
  const encKeys = generateX25519KeyPair();

  // Create DID Document
  const inputDocument: any = {
    verificationMethod: [
      {
        id: '#key-1',
        type: 'Ed25519VerificationKey2020',
        publicKeyMultibase: bytesToMultibase(authKeys.publicKey)
      },
      {
        id: '#key-2',
        type: 'X25519KeyAgreementKey2020',
        publicKeyMultibase: bytesToMultibase(encKeys.publicKey)
      }
    ],
    authentication: ['#key-1'],
    keyAgreement: ['#key-2']
  };

  // Generate the DID using peer4 library
  const longFormDid = peer4.encode(inputDocument);
  const resolvedDocument = peer4.resolve(longFormDid);

  // Store private keys
  const privateKeyData: any = {
    'key-1': {
      id: '#key-1',
      type: 'Ed25519VerificationKey2020',
      publicKeyMultibase: bytesToMultibase(authKeys.publicKey),
      privateKeyBytes: Array.from(authKeys.privateKey)
    },
    'key-2': {
      id: '#key-2',
      type: 'X25519KeyAgreementKey2020',
      publicKeyMultibase: bytesToMultibase(encKeys.publicKey),
      privateKeyBytes: Array.from(encKeys.privateKey)
    }
  };

  return {
    did: longFormDid,
    didDocument: resolvedDocument,
    privateKeys: privateKeyData,
    createdAt: new Date().toISOString()
  };
}

// Send mediation request to the mediator
async function sendMediationRequest(myDid: string) {
  const mediationRequest = {
    type: 'https://didcomm.org/coordinate-mediation/3.0/mediate-request',
    id: crypto.randomUUID(),
    from: myDid,
    to: [MEDIATOR_CONFIG.did],
    body: {}
  };

  console.log('Sending mediation request:', mediationRequest);

  try {
    const response = await fetch(MEDIATOR_CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/didcomm-encrypted+json'
      },
      body: JSON.stringify(mediationRequest)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('Mediation response:', result);
      return result;
    } else {
      console.error('Mediation request failed:', response.status, response.statusText);
      return null;
    }
  } catch (error) {
    console.error('Error sending mediation request:', error);
    return null;
  }
}

// Connect to the mediator and set up mediation
export async function connectToMediator(): Promise<{ success: boolean; did?: string; error?: string }> {
  try {
    // Check if we already have a DID and mediator connection
    let mobileDID = getMobileDID();

    if (!mobileDID) {
      console.log('No existing DID found, generating new DID...');
      mobileDID = await generateMobileDID();
      saveMobileDID(mobileDID);
      console.log('Generated DID:', mobileDID.did);
    } else {
      console.log('Using existing DID:', mobileDID.did);
    }

    // Check if mediator connection already exists
    const existingMediator = localStorage.getItem('mediator_connection');
    if (existingMediator) {
      console.log('Already connected to mediator');
      return { success: true, did: mobileDID.did };
    }

    // Send mediation request
    console.log('Requesting mediation from Indicio...');
    const mediationResponse = await sendMediationRequest(mobileDID.did);

    // Save mediator connection
    const mediatorConnection = {
      did: MEDIATOR_CONFIG.did,
      endpoint: MEDIATOR_CONFIG.endpoint,
      wsEndpoint: MEDIATOR_CONFIG.wsEndpoint,
      label: MEDIATOR_CONFIG.label,
      status: mediationResponse ? 'granted' : 'requested',
      mediationResponse,
      connectedAt: new Date().toISOString()
    };

    localStorage.setItem('mediator_connection', JSON.stringify(mediatorConnection));

    // Also save as a connection
    saveConnection({
      did: MEDIATOR_CONFIG.did,
      goalCode: 'mediation',
      goal: 'DIDComm Mediation',
      status: 'connected',
      isMediator: true
    });

    console.log('Mediator connection established');
    return { success: true, did: mobileDID.did };

  } catch (error) {
    console.error('Error connecting to mediator:', error);
    return { success: false, error: String(error) };
  }
}

// Get mediator connection status
export function getMediatorStatus() {
  const connection = localStorage.getItem('mediator_connection');
  return connection ? JSON.parse(connection) : null;
}

// Disconnect from mediator
export function disconnectMediator() {
  localStorage.removeItem('mediator_connection');
}
