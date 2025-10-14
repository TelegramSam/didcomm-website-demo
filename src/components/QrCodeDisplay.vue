<template>
  <div class="qr-display">
    <div class="qr-container">
      <h2>Scan to Login</h2>
      <div v-if="did" class="qr-code">
        <canvas ref="qrCanvas"></canvas>
      </div>
      <div v-else class="qr-placeholder">
        <p>Loading DID...</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from 'vue'
import QRCode from 'qrcode'
import { getSessionToken } from '../services/sessionService'

const props = defineProps({
  did: {
    type: String,
    default: null
  }
})

const qrCanvas = ref(null)

const generateQR = async () => {
  await nextTick()
  if (qrCanvas.value && props.did) {
    try {
      // Get the session token from Express backend
      // This is managed by express-session on the server
      const sessionToken = await getSessionToken()

      // Create DIDComm Out-of-Band invitation with embedded session token
      const oobInvitation = {
        type: 'https://didcomm.org/out-of-band/2.0/invitation',
        id: crypto.randomUUID(),
        from: props.did,
        body: {
          goal_code: 'login',
          goal: 'To login to the website',
          accept: ['didcomm/v2'],
          session_token: sessionToken
        },
        created_time: Math.floor(Date.now() / 1000),
        expires_time: Math.floor(Date.now() / 1000) + 300 // 5 minutes
      }

      // Encode as URL parameter
      const invitationJson = JSON.stringify(oobInvitation)
      const invitationUrl = `${window.location.origin}?_oob=${encodeURIComponent(invitationJson)}`

      QRCode.toCanvas(qrCanvas.value, invitationUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'L'
      })
      console.log('QR code generated with Express session token:', sessionToken)
    } catch (error) {
      console.error('Failed to generate QR code:', error)
    }
  } else {
    console.log('Canvas or DID not ready:', { canvas: !!qrCanvas.value, did: !!props.did })
  }
}

watch(
  () => props.did,
  () => {
    console.log('DID changed, regenerating QR code')
    generateQR()
  }
)

onMounted(() => {
  console.log('QrCodeDisplay mounted')
  generateQR()
})
</script>

<style scoped>
.qr-display {
  display: flex;
  justify-content: center;
}

.qr-container {
  background: white;
  padding: 2rem;
  border-radius: 0.5rem;
  width: 100%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.qr-container h2 {
  margin-top: 0;
  color: #333;
}

.qr-code {
  display: flex;
  justify-content: center;
  margin: 1.5rem 0;
}

.qr-code canvas {
  border: 2px solid #eee;
  border-radius: 0.5rem;
}

.qr-link {
  margin: 1rem 0 0 0;
  font-size: 1.1rem;
}

.qr-link a {
  color: #0066cc;
  text-decoration: none;
  font-weight: 500;
}

.qr-link a:hover {
  text-decoration: underline;
}

.qr-placeholder {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
  color: #999;
}
</style>
