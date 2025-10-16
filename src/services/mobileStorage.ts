// Mobile app storage service using localStorage

const STORAGE_KEYS = {
  CONNECTIONS: 'mobile_connections',
  MESSAGES: 'mobile_messages',
  SETTINGS: 'mobile_settings',
  DID: 'mobile_did',
  MEDIATOR: 'mediator_connection'
}

// Get all connections
export function getConnections() {
  const data = localStorage.getItem(STORAGE_KEYS.CONNECTIONS)
  return data ? JSON.parse(data) : []
}

// Save a connection
export function saveConnection(connection: any) {
  const connections = getConnections()
  connections.push({
    ...connection,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString()
  })
  localStorage.setItem(STORAGE_KEYS.CONNECTIONS, JSON.stringify(connections))
}

// Get all messages
export function getMessages() {
  const data = localStorage.getItem(STORAGE_KEYS.MESSAGES)
  return data ? JSON.parse(data) : []
}

// Save a message
export function saveMessage(message: any) {
  const messages = getMessages()
  messages.push({
    ...message,
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString()
  })
  localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages))
}

// Get settings
export function getSettings() {
  const data = localStorage.getItem(STORAGE_KEYS.SETTINGS)
  return data ? JSON.parse(data) : {}
}

// Save settings
export function saveSettings(settings: any) {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings))
}

// Get DID
export function getMobileDID() {
  const data = localStorage.getItem(STORAGE_KEYS.DID)
  return data ? JSON.parse(data) : null
}

// Save DID
export function saveMobileDID(did: any) {
  localStorage.setItem(STORAGE_KEYS.DID, JSON.stringify(did))
}

// Reset all data
export function resetAllData() {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key)
  })
}

// Update a message (e.g., to add response)
export function updateMessage(messageId: string, updates: any) {
  const messages = getMessages()
  const index = messages.findIndex((m: any) => m.id === messageId)
  if (index !== -1) {
    messages[index] = { ...messages[index], ...updates }
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages))
  }
}

// Clear all messages
export function clearMessages() {
  localStorage.removeItem(STORAGE_KEYS.MESSAGES)
}

// Get storage stats
export function getStorageStats() {
  return {
    connections: getConnections().length,
    messages: getMessages().length,
    hasDID: !!getMobileDID()
  }
}
