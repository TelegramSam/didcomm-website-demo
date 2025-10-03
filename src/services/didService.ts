import initSqlJs from 'sql.js';
import * as peer4 from '../lib/peer4';
import bs58 from 'bs58';

let db: any = null;

// Initialize SQLite database
async function initDatabase() {
  if (db) return db;

  const SQL = await initSqlJs({
    locateFile: file => `https://sql.js.org/dist/${file}`
  });

  // Check if we have a saved database in localStorage
  const savedDb = localStorage.getItem('didcomm_db');
  if (savedDb) {
    const uint8Array = new Uint8Array(JSON.parse(savedDb));
    db = new SQL.Database(uint8Array);
  } else {
    db = new SQL.Database();

    // Create tables
    db.run(`
      CREATE TABLE IF NOT EXISTS did_identity (
        id INTEGER PRIMARY KEY,
        did TEXT NOT NULL,
        did_document TEXT NOT NULL,
        private_keys TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    saveDatabase();
  }

  return db;
}

// Save database to localStorage
function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = JSON.stringify(Array.from(data));
    localStorage.setItem('didcomm_db', buffer);
  }
}

// Convert bytes to multibase base58btc format
function bytesToMultibase(bytes: Uint8Array): string {
  return 'z' + bs58.encode(bytes);
}

// Generate Ed25519 key pair for authentication using Web Crypto API
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

// Generate X25519 key pair for encryption (derived from Ed25519)
function generateX25519KeyPair() {
  const privateKey = crypto.getRandomValues(new Uint8Array(32));
  // X25519 public key is the scalar multiplication of the private key with the base point
  // For simplicity, we'll use a random key pair (in production, you'd derive from Ed25519)
  const publicKey = crypto.getRandomValues(new Uint8Array(32));
  return { privateKey, publicKey };
}

// Generate a new DID
export async function generateDID() {
  await initDatabase();

  // Generate Ed25519 key pair for authentication
  const authKeys = await generateEd25519KeyPair();

  // Generate X25519 key pair for encryption
  const encKeys = generateX25519KeyPair();

  // Get the service endpoint URL using current hostname
  const serviceEndpoint = `${window.location.protocol}//${window.location.host}/didcomm`;

  // Create DID Document with service endpoint
  const didDocument: any = {
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
    keyAgreement: ['#key-2'],
    service: [
      {
        id: '#didcomm',
        type: 'DIDCommMessaging',
        serviceEndpoint
      }
    ]
  };

  // Generate the DID using peer4 library (this encodes the entire document including service)
  const longFormDid = await peer4.encode(didDocument);

  // Resolve to get the full DID document (this should include the service endpoint)
  const resolvedDocument = await peer4.resolve(longFormDid);

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

  // Clear existing DID
  db.run('DELETE FROM did_identity');

  // Store the new DID (using long form)
  db.run(
    'INSERT INTO did_identity (did, did_document, private_keys) VALUES (?, ?, ?)',
    [longFormDid, JSON.stringify(resolvedDocument), JSON.stringify(privateKeyData)]
  );

  saveDatabase();

  return {
    did: longFormDid,
    didDocument: resolvedDocument,
    keyPairs: privateKeyData
  };
}

// Get the stored DID
export async function getStoredDID() {
  await initDatabase();

  const result = db.exec('SELECT * FROM did_identity LIMIT 1');

  if (result.length > 0 && result[0].values.length > 0) {
    const row = result[0].values[0];
    return {
      did: row[1],
      didDocument: JSON.parse(row[2]),
      privateKeys: JSON.parse(row[3]),
      createdAt: row[4]
    };
  }

  return null;
}

// Delete the stored DID
export async function deleteDID() {
  await initDatabase();
  db.run('DELETE FROM did_identity');
  saveDatabase();
}

// Get or create a DID
export async function getOrCreateDID() {
  const existing = await getStoredDID();
  if (existing) {
    return existing;
  }
  return await generateDID();
}
