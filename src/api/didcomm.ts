// DIDComm message endpoint handler
export async function handleDIDCommMessage(message: any) {
  console.log('Received DIDComm message:', message);

  // Store message in localStorage for now (you can enhance this later)
  const messages = JSON.parse(localStorage.getItem('didcomm_messages') || '[]');
  messages.push({
    message,
    receivedAt: new Date().toISOString()
  });
  localStorage.setItem('didcomm_messages', JSON.stringify(messages));

  return {
    status: 'success',
    message: 'DIDComm message received'
  };
}

// Get stored messages
export function getStoredMessages() {
  return JSON.parse(localStorage.getItem('didcomm_messages') || '[]');
}

// Clear stored messages
export function clearMessages() {
  localStorage.removeItem('didcomm_messages');
}
