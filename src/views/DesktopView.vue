<template>
  <div class="desktop-app">
    <header>
      <h1>Example Website</h1>
      <p>QR Code Scanner for DIDComm v2 Messages</p>
    </header>
    <main>
      <QrCodeDisplay :did="didInfo?.did" />
      <aside class="info-panel">
        <div class="mobile-qr-section">
          <h3>Open Login Wallet App on Your Phone</h3>
          <div class="mobile-qr">
            <canvas ref="mobileQrCanvas"></canvas>
          </div>
        </div>

        <details class="did-details">
          <summary>Advanced</summary>
          <div v-if="loading" class="loading-state">
            <p>Loading DID...</p>
          </div>
          <div v-else-if="didInfo" class="did-info">
            <h4>Server DID</h4>
            <div class="did-display">
              <code>{{ didInfo.did }}</code>
            </div>
          </div>
          <div v-else class="error-state">
            <p>Failed to load DID</p>
            <button @click="loadDID">Retry</button>
          </div>
        </details>
      </aside>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import QrCodeDisplay from '../components/QrCodeDisplay.vue'
import QRCode from 'qrcode'

const didInfo = ref(null)
const loading = ref(true)
const mobileQrCanvas = ref(null)

const loadDID = async () => {
  loading.value = true
  try {
    // Fetch server DID from backend
    const response = await fetch('http://localhost:3000/api/did', {
      credentials: 'include'
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    didInfo.value = {
      did: result.did,
      didDocument: result.didDocument,
      createdAt: null
    }
    console.log('Loaded server DID:', result.did)
  } catch (error) {
    console.error('Failed to load DID:', error)
    didInfo.value = null
  } finally {
    loading.value = false
  }
}

const formatDate = dateStr => {
  if (!dateStr) return 'Just now'
  return new Date(dateStr).toLocaleString()
}

const generateMobileQR = () => {
  if (mobileQrCanvas.value) {
    const mobileUrl = `${window.location.protocol}//${window.location.host}/mobile`
    QRCode.toCanvas(mobileQrCanvas.value, mobileUrl, {
      width: 250,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })
  }
}

onMounted(() => {
  loadDID()
  generateMobileQR()
})
</script>

<style scoped>
.desktop-app {
  min-height: 100vh;
  background: #f5f5f5;
  color: #333;
  font-family: Arial, sans-serif;
}

header {
  padding: 2rem;
  text-align: center;
  background: #fff;
  border-bottom: 1px solid #ddd;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

header h1 {
  margin: 0;
  color: #333;
}

header p {
  font-size: 1.2rem;
  margin: 0.5rem 0 0 0;
  color: #666;
}

main {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.info-panel {
  background: #fff;
  padding: 2rem;
  border-radius: 0.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.info-panel h2,
.info-panel h3 {
  margin-top: 0;
  color: #333;
}

.info-panel p {
  color: #666;
}

.info-panel a {
  color: #0066cc;
  text-decoration: underline;
}

.info-panel a:hover {
  color: #0052a3;
}

.did-details {
  margin-top: 2rem;
  border: 1px solid #ddd;
  border-radius: 0.5rem;
  padding: 0.5rem;
}

.did-details h4 {
  margin: 0 0 0.5rem 0;
  color: #333;
  font-size: 1rem;
}

.did-details summary {
  cursor: pointer;
  font-weight: 600;
  color: #666;
  padding: 0.5rem;
  user-select: none;
}

.did-details summary:hover {
  color: #333;
}

.did-details[open] summary {
  margin-bottom: 1rem;
  border-bottom: 1px solid #ddd;
}

.mobile-qr-section {
  text-align: center;
}

.mobile-qr-section h3 {
  margin-bottom: 1rem;
}

.mobile-qr {
  display: flex;
  justify-content: center;
  padding: 1rem;
  background: #f9f9f9;
  border-radius: 0.5rem;
  border: 2px solid #eee;
}

.did-info {
  margin-bottom: 2rem;
}

.did-display {
  background: #f9f9f9;
  border: 1px solid #ddd;
  border-radius: 0.5rem;
  padding: 1rem;
  margin: 1rem 0;
  word-break: break-all;
}

.did-display code {
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  color: #0066cc;
}

.did-meta {
  font-size: 0.85rem;
  color: #999;
  margin: 0.5rem 0;
}

.reset-button {
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

.reset-button:hover {
  background: #c82333;
}

.loading-state,
.error-state {
  padding: 1rem;
  text-align: center;
}

.error-state button {
  background: #0066cc;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  cursor: pointer;
}

.error-state button:hover {
  background: #0052a3;
}

@media (max-width: 768px) {
  main {
    grid-template-columns: 1fr;
  }
}
</style>
