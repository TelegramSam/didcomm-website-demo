<template>
  <div class="mobile-app">
    <header>
      <h1>Website Connect</h1>
    </header>
    <main>
      <QrScanner @connection-created="handleConnectionCreated" />
    </main>
    <footer>
      <div class="storage-info">
        <p class="mediator-status" :class="{ 'connecting': isConnectingToMediator }">
          {{ mediatorStatus }}
        </p>
        <p>Connections: {{ storageStats.connections }} | Messages: {{ storageStats.messages }}</p>
      </div>
      <div class="button-group">
        <button @click="goToAdvanced" class="advanced-button">
          Advanced
        </button>
        <button @click="handleResetAll" class="reset-all-button">
          Reset All
        </button>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import QrScanner from '../components/QrScanner.vue';
import { resetAllData, getStorageStats } from '../services/mobileStorage';
import { connectToMediator, getMediatorStatus } from '../services/mediatorService';

const router = useRouter();
const storageStats = ref({ connections: 0, messages: 0, hasDID: false });
const mediatorStatus = ref('Not connected');
const isConnectingToMediator = ref(false);

const updateStats = () => {
  storageStats.value = getStorageStats();

  // Update mediator status
  const status = getMediatorStatus();
  if (status) {
    mediatorStatus.value = `Connected to ${status.label}`;
  }
};

const handleConnectionCreated = (connection) => {
  console.log('Connection created:', connection);
  updateStats();
};

const goToAdvanced = () => {
  router.push('/mobile/advanced');
};

const handleResetAll = () => {
  if (confirm('Are you sure you want to delete all data? This cannot be undone.')) {
    resetAllData();
    updateStats();
    mediatorStatus.value = 'Not connected';
    alert('All data has been deleted.');
    // Reconnect to mediator after reset
    initializeMediator();
  }
};

const initializeMediator = async () => {
  isConnectingToMediator.value = true;
  mediatorStatus.value = 'Connecting to mediator...';

  const result = await connectToMediator();

  isConnectingToMediator.value = false;

  if (result.success) {
    console.log('Successfully connected to mediator');
    updateStats();
  } else {
    console.error('Failed to connect to mediator:', result.error);
    mediatorStatus.value = 'Connection failed';
  }
};

onMounted(() => {
  updateStats();
  initializeMediator();
});
</script>

<style scoped>
.mobile-app {
  min-height: 100vh;
  background: #f5f5f5;
  color: #333;
  font-family: Arial, sans-serif;
  display: flex;
  flex-direction: column;
}

header {
  padding: 1rem;
  text-align: center;
  background: #fff;
  border-bottom: 1px solid #ddd;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

header h1 {
  margin: 0;
  font-size: 1.5rem;
  color: #333;
}

main {
  flex: 1;
  padding: 1rem;
}

footer {
  background: #fff;
  border-top: 1px solid #ddd;
  padding: 1rem;
  text-align: center;
}

.storage-info {
  margin-bottom: 1rem;
}

.storage-info p {
  margin: 0;
  font-size: 0.85rem;
  color: #666;
}

.button-group {
  display: flex;
  gap: 0.5rem;
  width: 100%;
  max-width: 400px;
}

.advanced-button {
  background: #007bff;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  flex: 1;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.advanced-button:hover {
  background: #0056b3;
}

.advanced-button:active {
  transform: scale(0.98);
}

.reset-all-button {
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  flex: 1;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.reset-all-button:hover {
  background: #c82333;
}

.reset-all-button:active {
  transform: scale(0.98);
}
</style>
