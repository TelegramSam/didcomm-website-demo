<template>
  <div class="advanced-view">
    <header>
      <button @click="goBack" class="back-button">
        ← Back
      </button>
      <h1>Advanced Settings</h1>
    </header>

    <main>
      <section class="section">
        <h2>Mobile DID</h2>
        <div v-if="mobileDID" class="did-container">
          <div class="did-header">
            <h3>{{ mobileDID.did }}</h3>
            <button @click="copyToClipboard(mobileDID.did)" class="copy-button">
              Copy
            </button>
          </div>

          <div class="info-item">
            <span class="label">Created:</span>
            <span class="value">{{ formatDate(mobileDID.createdAt) }}</span>
          </div>

          <div v-if="mobileDID.didDocument.service && mobileDID.didDocument.service.length > 0" class="service-endpoints">
            <h4>DIDComm Service Endpoints</h4>
            <div v-for="(service, idx) in mobileDID.didDocument.service" :key="idx" class="service-item">
              <div class="service-header">
                <span class="service-type">{{ service.type }}</span>
                <span class="service-id">{{ service.id }}</span>
              </div>
              <div class="info-item">
                <span class="label">Endpoint:</span>
                <span class="value monospace">{{ service.serviceEndpoint }}</span>
              </div>
              <div v-if="service.accept" class="info-item">
                <span class="label">Accept:</span>
                <span class="value">{{ service.accept.join(', ') }}</span>
              </div>
              <div v-if="service.routingKeys && service.routingKeys.length > 0" class="info-item">
                <span class="label">Routing Keys:</span>
                <div v-for="(key, keyIdx) in service.routingKeys" :key="keyIdx" class="routing-key">
                  <span class="value monospace">{{ key }}</span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="mobileDID.privateKeys" class="keys-section">
            <h4>Verification Methods (Keys)</h4>
            <div v-for="(key, keyId) in mobileDID.privateKeys" :key="keyId" class="key-item">
              <div class="key-header">
                <span class="key-id">{{ key.id }}</span>
                <span class="key-type">{{ key.type }}</span>
              </div>
              <div class="key-info">
                <span class="label">Public Key:</span>
                <span class="value monospace">{{ key.publicKeyMultibase }}</span>
              </div>
            </div>
          </div>

          <div class="did-document">
            <h4>Full DID Document (JSON)</h4>
            <div class="json-viewer">
              <pre>{{ formatJSON(mobileDID.didDocument) }}</pre>
            </div>
          </div>
        </div>
        <div v-else class="no-data">
          <p>No DID found. Create a connection to generate a DID.</p>
        </div>
      </section>

      <section class="section">
        <h2>Mediator Connection</h2>
        <div v-if="mediatorConnection" class="mediator-container">
          <div class="info-item">
            <span class="label">Mediator DID:</span>
            <span class="value monospace">{{ mediatorConnection.did }}</span>
            <button @click="copyToClipboard(mediatorConnection.did)" class="copy-button-inline">
              Copy
            </button>
          </div>

          <div class="info-item">
            <span class="label">Label:</span>
            <span class="value">{{ mediatorConnection.label }}</span>
          </div>

          <div class="info-item">
            <span class="label">Status:</span>
            <span class="value status" :class="mediatorConnection.status">
              {{ mediatorConnection.status }}
            </span>
          </div>

          <div class="info-item">
            <span class="label">Endpoint:</span>
            <span class="value monospace">{{ mediatorConnection.endpoint }}</span>
          </div>

          <div class="info-item">
            <span class="label">WebSocket:</span>
            <span class="value monospace">{{ mediatorConnection.wsEndpoint }}</span>
          </div>

          <div class="info-item">
            <span class="label">Connected:</span>
            <span class="value">{{ formatDate(mediatorConnection.connectedAt) }}</span>
          </div>

          <div v-if="mediatorConnection.mediationResponse" class="mediation-response">
            <h4>Mediation Response</h4>
            <div class="json-viewer">
              <pre>{{ formatJSON(mediatorConnection.mediationResponse) }}</pre>
            </div>
          </div>
        </div>
        <div v-else class="no-data">
          <p>Not connected to a mediator.</p>
        </div>
      </section>

      <section class="section">
        <h2>All Connections</h2>
        <div v-if="connections.length > 0">
          <div v-for="conn in connections" :key="conn.id" class="connection-item">
            <div class="connection-header">
              <h4>{{ conn.goal || 'Unknown Connection' }}</h4>
              <span class="status" :class="conn.status">{{ conn.status }}</span>
            </div>
            <div class="info-item">
              <span class="label">DID:</span>
              <span class="value monospace">{{ conn.did }}</span>
            </div>
            <div v-if="conn.goalCode" class="info-item">
              <span class="label">Goal Code:</span>
              <span class="value">{{ conn.goalCode }}</span>
            </div>
            <div class="info-item">
              <span class="label">Created:</span>
              <span class="value">{{ formatDate(conn.createdAt) }}</span>
            </div>
          </div>
        </div>
        <div v-else class="no-data">
          <p>No connections yet.</p>
        </div>
      </section>

      <section class="section message-log-section">
        <h2>Message Log</h2>
        <div v-if="messages.length > 0" class="message-log-container">
          <div v-for="msg in messages" :key="msg.id" class="message-log-item" :class="msg.direction">
            <div class="message-header">
              <div class="message-direction">
                <span class="direction-badge" :class="msg.direction">
                  {{ msg.direction === 'outbound' ? '→ OUT' : '← IN' }}
                </span>
                <span class="message-type">{{ formatMessageType(msg.type) }}</span>
              </div>
              <span class="message-time">{{ formatTime(msg.timestamp || msg.receivedAt) }}</span>
            </div>
            <div class="message-details">
              <div class="info-item">
                <span class="label">From:</span>
                <span class="value monospace small">{{ msg.from || 'Unknown' }}</span>
              </div>
              <div class="info-item">
                <span class="label">To:</span>
                <span class="value monospace small">{{ formatRecipients(msg.to) }}</span>
              </div>
              <div v-if="msg.status" class="info-item">
                <span class="label">Status:</span>
                <span class="status" :class="msg.status">{{ msg.status }}</span>
              </div>
            </div>
            <div v-if="msg.message" class="message-body">
              <details>
                <summary>View Full Message</summary>
                <pre>{{ formatJSON(msg.message) }}</pre>
              </details>
            </div>
          </div>
        </div>
        <div v-else class="no-data">
          <p>No messages logged yet.</p>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getMobileDID, getConnections, getMessages } from '../services/mobileStorage';
import { getMediatorStatus } from '../services/mediatorService';

const router = useRouter();
const mobileDID = ref(null);
const mediatorConnection = ref(null);
const connections = ref([]);
const messages = ref([]);

const goBack = () => {
  router.push('/mobile');
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString();
};

const formatTime = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleTimeString() + ' ' + date.toLocaleDateString();
};

const formatJSON = (obj) => {
  return JSON.stringify(obj, null, 2);
};

const formatMessageType = (type) => {
  if (!type) return 'Unknown';
  const parts = type.split('/');
  return parts[parts.length - 1] || type;
};

const formatRecipients = (to) => {
  if (!to) return 'Unknown';
  if (Array.isArray(to)) {
    return to.join(', ');
  }
  return String(to);
};

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  } catch (err) {
    console.error('Failed to copy:', err);
    alert('Failed to copy to clipboard');
  }
};

const loadData = () => {
  mobileDID.value = getMobileDID();
  mediatorConnection.value = getMediatorStatus();
  connections.value = getConnections();

  // Load messages in reverse chronological order (newest first)
  const allMessages = getMessages();
  messages.value = allMessages.reverse();
};

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.advanced-view {
  min-height: 100vh;
  background: #f5f5f5;
  color: #333;
  font-family: Arial, sans-serif;
  display: flex;
  flex-direction: column;
}

header {
  position: sticky;
  top: 0;
  padding: 1rem;
  background: #fff;
  border-bottom: 1px solid #ddd;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 1rem;
  z-index: 10;
}

.back-button {
  background: #007bff;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
}

.back-button:hover {
  background: #0056b3;
}

header h1 {
  margin: 0;
  font-size: 1.5rem;
  color: #333;
  flex: 1;
}

main {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
}

.section {
  background: white;
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.section h2 {
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
  color: #333;
  border-bottom: 2px solid #007bff;
  padding-bottom: 0.5rem;
}

.section h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  color: #555;
  word-break: break-all;
}

.section h4 {
  margin: 1rem 0 0.5rem 0;
  font-size: 1rem;
  color: #666;
}

.did-container,
.mediator-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.did-header {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.copy-button {
  background: #28a745;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.875rem;
  white-space: nowrap;
}

.copy-button:hover {
  background: #218838;
}

.copy-button-inline {
  background: #28a745;
  color: white;
  border: none;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.75rem;
  margin-left: 0.5rem;
}

.copy-button-inline:hover {
  background: #218838;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-item .label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #666;
}

.info-item .value {
  font-size: 0.875rem;
  color: #333;
  word-break: break-word;
}

.monospace {
  font-family: 'Courier New', monospace;
  font-size: 0.8rem;
}

.status {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status.connected,
.status.granted {
  background: #d4edda;
  color: #155724;
}

.status.requested {
  background: #fff3cd;
  color: #856404;
}

.status.pending {
  background: #cce5ff;
  color: #004085;
}

.did-document,
.mediation-response {
  margin-top: 1rem;
}

.json-viewer {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 0.25rem;
  padding: 0.75rem;
  overflow-x: auto;
  max-height: 400px;
  overflow-y: auto;
}

.json-viewer pre {
  margin: 0;
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  color: #333;
  white-space: pre-wrap;
  word-break: break-word;
}

.service-endpoints {
  margin-top: 1rem;
}

.service-item {
  background: #e7f3ff;
  border: 2px solid #007bff;
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 0.5rem;
}

.service-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #007bff;
}

.service-type {
  font-size: 1rem;
  font-weight: 700;
  color: #007bff;
}

.service-id {
  font-size: 0.75rem;
  color: #666;
  font-family: 'Courier New', monospace;
}

.routing-key {
  background: #f8f9fa;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  margin-top: 0.25rem;
  border-left: 3px solid #007bff;
}

.keys-section {
  margin-top: 1rem;
}

.key-item {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 0.25rem;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
}

.key-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.key-id {
  font-size: 0.875rem;
  font-weight: 600;
  color: #333;
}

.key-type {
  font-size: 0.75rem;
  color: #666;
  background: #e9ecef;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
}

.key-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.connection-item {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 0.25rem;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
}

.connection-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.connection-header h4 {
  margin: 0;
  font-size: 1rem;
  color: #333;
}

.no-data {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.no-data p {
  margin: 0;
  font-size: 0.875rem;
}

/* Message Log Styles */
.message-log-section {
  margin-bottom: 2rem;
}

.message-log-container {
  max-height: 500px;
  overflow-y: auto;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 0.5rem;
  padding: 0.5rem;
}

.message-log-item {
  background: white;
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 0.75rem;
  border-left: 4px solid #6c757d;
}

.message-log-item.outbound {
  border-left-color: #28a745;
}

.message-log-item.inbound {
  border-left-color: #007bff;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #dee2e6;
}

.message-direction {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.direction-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: white;
}

.direction-badge.outbound {
  background: #28a745;
}

.direction-badge.inbound {
  background: #007bff;
}

.message-type {
  font-size: 0.875rem;
  font-weight: 600;
  color: #333;
}

.message-time {
  font-size: 0.75rem;
  color: #666;
}

.message-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.message-details .info-item {
  display: flex;
  gap: 0.5rem;
  align-items: baseline;
}

.message-details .small {
  font-size: 0.75rem;
  word-break: break-all;
}

.message-body details {
  margin-top: 0.5rem;
}

.message-body summary {
  cursor: pointer;
  font-size: 0.875rem;
  color: #007bff;
  font-weight: 600;
  padding: 0.25rem 0;
}

.message-body summary:hover {
  color: #0056b3;
}

.message-body pre {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 0.25rem;
  padding: 0.75rem;
  margin-top: 0.5rem;
  overflow-x: auto;
  font-size: 0.75rem;
  max-height: 300px;
  overflow-y: auto;
}

.status.sent,
.status.sent-encrypted {
  background: #d4edda;
  color: #155724;
}

.status.encrypting {
  background: #fff3cd;
  color: #856404;
}

.status.received {
  background: #cce5ff;
  color: #004085;
}

.status.error {
  background: #f8d7da;
  color: #721c24;
}
</style>
