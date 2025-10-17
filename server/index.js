// Express.js server with session management for DIDComm login
import express from 'express'
import session from 'express-session'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { SERVER_DID_DATA, didResolver, unpackMessage, packMessage } from './didcomm-handler.js'

const app = express()
const PORT = 3000

// Session configuration
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'didcomm-demo-secret-change-in-production',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },
  name: 'didcomm.sid' // Custom session cookie name
}

// Middleware
app.use(
  cors({
    origin: true, // Allow any origin (for local network access)
    credentials: true // Allow cookies to be sent
  })
)
app.use(cookieParser())
app.use(express.json())
app.use(express.text({ type: 'application/didcomm-encrypted+json' }))
app.use(express.text({ type: 'text/plain' }))
app.use(session(sessionConfig))

// Logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, {
    sessionID: req.sessionID,
    hasSession: !!req.session
  })
  next()
})

// API endpoint to get session token
app.get('/api/session', (req, res) => {
  // Express-session automatically creates a session if one doesn't exist
  const sessionToken = req.sessionID

  // Store session creation time if not already set
  if (!req.session.createdAt) {
    req.session.createdAt = Date.now()
  }

  res.json({
    success: true,
    sessionToken: sessionToken,
    createdAt: req.session.createdAt,
    cookie: req.session.cookie
  })
})

// API endpoint to receive DIDComm session-login messages
app.post('/api/didcomm/session-login', (req, res) => {
  const message = req.body
  console.log('Received DIDComm session-login message:', message)

  // Extract session token from message body
  const sessionTokenFromWallet = message.body?.session_token

  if (!sessionTokenFromWallet) {
    return res.status(400).json({
      success: false,
      error: 'Missing session_token in message body'
    })
  }

  // In a real implementation, you would:
  // 1. Validate the session token matches an active browser session
  // 2. Verify the DID and signature
  // 3. Associate the wallet DID with the browser session
  // 4. Mark the session as authenticated

  console.log('Session token from wallet:', sessionTokenFromWallet)
  console.log('Current request session ID:', req.sessionID)

  // Store wallet connection in session
  req.session.walletDID = message.from
  req.session.authenticated = true
  req.session.authenticatedAt = Date.now()

  res.json({
    success: true,
    message: 'Session login received',
    sessionToken: req.sessionID
  })
})

// API endpoint to send session-connected message
app.post('/api/didcomm/session-connected', (req, res) => {
  const { walletDID } = req.body

  if (!req.session.authenticated) {
    return res.status(401).json({
      success: false,
      error: 'Session not authenticated'
    })
  }

  // In a real implementation, send actual DIDComm message to wallet
  const sessionConnectedMessage = {
    type: 'https://didcomm.org/login/1.0/session-connected',
    id: crypto.randomUUID(),
    from: 'website-did', // Should be the actual website DID
    to: [walletDID],
    thid: req.body.threadId,
    created_time: Math.floor(Date.now() / 1000),
    body: {}
  }

  console.log('Sending session-connected message:', sessionConnectedMessage)

  res.json({
    success: true,
    message: sessionConnectedMessage
  })
})

// Check session authentication status
app.get('/api/session/status', (req, res) => {
  res.json({
    authenticated: !!req.session.authenticated,
    walletDID: req.session.walletDID,
    sessionID: req.sessionID,
    createdAt: req.session.createdAt,
    authenticatedAt: req.session.authenticatedAt
  })
})

// Destroy session (logout)
app.post('/api/session/destroy', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: 'Failed to destroy session'
      })
    }
    res.clearCookie('didcomm.sid')
    res.json({
      success: true,
      message: 'Session destroyed'
    })
  })
})

// In-memory storage for DIDComm messages (in production, use a database)
const messageStore = new Map()
const sessionMessageQueue = new Map() // Maps session tokens to message queues

// DIDComm message receiving endpoint
app.post('/didcomm', async (req, res) => {
  console.log('=== Received DIDComm message on /didcomm ===')

  const packedMessage = req.body

  try {
    // Step 1: Unpack (decrypt) the message
    let message, metadata
    try {
      const unpacked = await unpackMessage(packedMessage)
      message = unpacked.message
      metadata = unpacked.metadata

      // Helper function to truncate long-form did:peer:4 DIDs
      const truncateDID = (did) => {
        if (typeof did === 'string' && did.startsWith('did:peer:4') && did.includes(':z')) {
          const parts = did.split(':')
          return `${parts[0]}:${parts[1]}:${parts[2]}`
        }
        return did
      }

      // Create a display version with truncated DIDs
      const displayMessage = {
        ...message,
        from: truncateDID(message.from),
        to: Array.isArray(message.to) ? message.to.map(truncateDID) : truncateDID(message.to)
      }

      console.log('=== Unpacked DIDComm message ===')
      console.log('Message type:', message.type)
      console.log('Message ID:', message.id)
      console.log('From:', truncateDID(message.from))
      console.log('To:', message.to ? (Array.isArray(message.to) ? message.to.map(truncateDID) : truncateDID(message.to)) : undefined)
      console.log('Encrypted:', metadata.encrypted)
      console.log('Authenticated:', metadata.authenticated)
      console.log('Full message:', JSON.stringify(displayMessage, null, 2))
    } catch (unpackError) {
      console.error('Failed to unpack message:', unpackError.message)
      return res.status(400).json({
        error: 'Failed to decrypt DIDComm message',
        details: unpackError.message
      })
    }

    // Step 2: Validate basic DIDComm message structure
    if (!message.type || !message.id) {
      return res.status(400).json({
        error: 'Invalid DIDComm message',
        details: 'Missing required fields: type or id'
      })
    }

    // Store the message
    const messageRecord = {
      id: message.id,
      type: message.type,
      from: message.from,
      to: message.to,
      body: message.body,
      thid: message.thid, // thread ID
      pthid: message.pthid, // parent thread ID
      receivedAt: new Date().toISOString(),
      processed: false
    }

    messageStore.set(message.id, messageRecord)

    // Route message based on type
    const messageType = message.type
    let responseMessage = null

    // Handle different DIDComm message types
    if (messageType.includes('/login/')) {
      responseMessage = await handleLoginMessage(message, req)
    } else if (messageType.includes('/mediate-request')) {
      responseMessage = await handleMediationRequest(message)
    } else if (messageType.includes('/trust-ping')) {
      responseMessage = await handleTrustPing(message)
    } else if (messageType === 'https://didcomm.org/user-profile/1.0/request-profile') {
      responseMessage = await handleUserProfileRequest(message)
    } else if (messageType.includes('/basic-message')) {
      responseMessage = await handleBasicMessage(message)
    } else if (messageType.includes('/out-of-band/')) {
      responseMessage = await handleOutOfBandInvitation(message)
    } else {
      console.log(`Unknown message type: ${messageType}, storing for later processing`)
    }

    // Mark as processed
    messageRecord.processed = true
    messageRecord.processedAt = new Date().toISOString()

    // Queue message for session if session token is in body
    if (message.body?.session_token) {
      const sessionToken = message.body.session_token
      if (!sessionMessageQueue.has(sessionToken)) {
        sessionMessageQueue.set(sessionToken, [])
      }
      sessionMessageQueue.get(sessionToken).push(messageRecord)
    }

    // If there's a response message, send it to the sender's DID endpoint
    if (responseMessage) {
      try {
        await sendDIDCommMessage(responseMessage, message.from)
        console.log('Sent response message to:', message.from)
      } catch (sendError) {
        console.error('Failed to send response message:', sendError.message)
      }
    }

    // Always return simple acknowledgment in HTTP response
    res.status(200).json({
      status: 'received',
      message_id: message.id
    })
  } catch (error) {
    console.error('Error processing DIDComm message:', error)
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    })
  }
})

// Helper function to send a DIDComm message to a recipient
async function sendDIDCommMessage(message, recipientDID) {
  let endpoint // Declare at function scope for error logging
  try {
    // Resolve the recipient's DID to get their service endpoint
    const recipientDoc = await didResolver.resolve(recipientDID)

    if (!recipientDoc || !recipientDoc.service || recipientDoc.service.length === 0) {
      throw new Error('Recipient DID has no service endpoints')
    }

    // Find DIDCommMessaging service
    const didcommService = recipientDoc.service.find(s => s.type === 'DIDCommMessaging')
    if (!didcommService) {
      throw new Error('Recipient DID has no DIDCommMessaging service')
    }

    // Get the service endpoint URI
    if (typeof didcommService.serviceEndpoint === 'string') {
      endpoint = didcommService.serviceEndpoint
    } else if (didcommService.serviceEndpoint.uri) {
      endpoint = didcommService.serviceEndpoint.uri
    } else {
      throw new Error('Invalid service endpoint format')
    }

    // Get routing keys if present
    let routingKeys = []
    if (didcommService.routingKeys && Array.isArray(didcommService.routingKeys)) {
      routingKeys = didcommService.routingKeys
    }

    // If endpoint is a DID (mediator), resolve it to get actual HTTP endpoint
    let mediatorDID = null
    if (endpoint.startsWith('did:')) {
      console.log('Endpoint is a mediator DID:', endpoint)
      mediatorDID = endpoint

      // Resolve the mediator's DID to get its actual endpoint
      const mediatorDoc = await didResolver.resolve(mediatorDID)
      if (!mediatorDoc || !mediatorDoc.service || mediatorDoc.service.length === 0) {
        throw new Error('Mediator DID has no service endpoints')
      }

      const mediatorService = mediatorDoc.service.find(s => s.type === 'DIDCommMessaging')
      if (!mediatorService) {
        throw new Error('Mediator DID has no DIDCommMessaging service')
      }

      // Get mediator's actual HTTP endpoint
      if (typeof mediatorService.serviceEndpoint === 'string') {
        endpoint = mediatorService.serviceEndpoint
      } else if (mediatorService.serviceEndpoint.uri) {
        endpoint = mediatorService.serviceEndpoint.uri
      } else {
        throw new Error('Mediator has invalid service endpoint format')
      }

      // Add mediator's keyAgreement keys to routing keys if not already present
      if (mediatorDoc.keyAgreement && routingKeys.length === 0) {
        routingKeys = mediatorDoc.keyAgreement.map(ka => {
          if (typeof ka === 'string') return ka
          return ka.id
        })
      }
    }

    console.log('Sending message to endpoint:', endpoint)
    if (mediatorDID) {
      console.log('Via mediator:', mediatorDID)
      console.log('Routing keys:', routingKeys)
    }

    // Helper function to truncate long-form did:peer:4 DIDs
    const truncateDID = (did) => {
      if (typeof did === 'string' && did.startsWith('did:peer:4') && did.includes(':z')) {
        const parts = did.split(':')
        return `${parts[0]}:${parts[1]}:${parts[2]}`
      }
      return did
    }

    // Create a display version with truncated DIDs for logging
    const displayMessage = {
      ...message,
      from: truncateDID(message.from),
      to: Array.isArray(message.to) ? message.to.map(truncateDID) : truncateDID(message.to)
    }

    console.log('=== Outbound DIDComm message ===')
    console.log('Message type:', message.type)
    console.log('Message ID:', message.id)
    console.log('From:', truncateDID(message.from))
    console.log('To:', message.to ? (Array.isArray(message.to) ? message.to.map(truncateDID) : truncateDID(message.to)) : undefined)
    console.log('Full message:', JSON.stringify(displayMessage, null, 2))

    // Pack the message (encrypt it)
    // If using mediator, need to wrap in forward message
    let messageToSend

    if (mediatorDID) {
      // First, pack the message for the final recipient
      const { message: packedForRecipient } = await packMessage(
        message,
        recipientDID,
        SERVER_DID_DATA.did,
        null
      )

      // Create a forward message for the mediator
      // According to DIDComm routing spec, the attachment should contain the encrypted message
      // as a base64-encoded string
      const forwardMessage = {
        type: 'https://didcomm.org/routing/2.0/forward',
        id: crypto.randomUUID(),
        to: [mediatorDID],
        body: {
          next: recipientDID
        },
        attachments: [
          {
            id: crypto.randomUUID(),
            media_type: 'application/didcomm-encrypted+json',
            data: {
              base64: Buffer.from(packedForRecipient).toString('base64')
            }
          }
        ]
      }

      console.log('Forward message (before packing):', JSON.stringify(forwardMessage, null, 2))

      // Pack the forward message for the mediator
      console.log('Packing forward message for mediator:', truncateDID(mediatorDID))
      const { message: packedForwardMessage } = await packMessage(
        forwardMessage,
        mediatorDID,
        SERVER_DID_DATA.did,
        null
      )

      messageToSend = packedForwardMessage
    } else {
      // Direct send - pack message for recipient
      console.log('Packing message from:', truncateDID(SERVER_DID_DATA.did), 'to:', truncateDID(recipientDID))
      const { message: packedMessage } = await packMessage(
        message,
        recipientDID,
        SERVER_DID_DATA.did,
        null
      )
      messageToSend = packedMessage
    }

    console.log('Message packed successfully')

    // Validate the packed message is valid JSON
    try {
      const parsedMessage = JSON.parse(messageToSend)
      console.log('Packed message is valid JSON, length:', messageToSend.length)
      console.log('Packed message:', JSON.stringify(parsedMessage, null, 2))
    } catch (e) {
      console.error('Packed message is NOT valid JSON:', e.message)
      throw new Error('Invalid packed message format')
    }

    // Send the packed message to the endpoint
    console.log('Sending POST request to URI:', endpoint)
    console.log('Content-Type: application/didcomm-encrypted+json')
    console.log('Body length:', messageToSend.length, 'bytes')

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/didcomm-encrypted+json'
      },
      body: messageToSend
    })

    console.log('HTTP response status:', response.status, response.statusText)
    if (!response.ok) {
      const responseText = await response.text()

      // Check if response is a DIDComm problem-report
      try {
        const responseJson = JSON.parse(responseText)
        if (responseJson.type && responseJson.type.includes('problem-report')) {
          console.error('=== DIDComm Problem Report Received ===')
          console.error('Problem Type:', responseJson.type)
          console.error('Problem ID:', responseJson.id)
          console.error('Error Code:', responseJson.body?.code)
          console.error('Error Comment:', responseJson.body?.comment)
          if (responseJson.body?.args) {
            console.error('Error Args:', responseJson.body.args)
          }
          console.error('Full problem report:', JSON.stringify(responseJson, null, 2))
          console.error('======================================')
          throw new Error(`DIDComm Problem: ${responseJson.body?.comment || 'Unknown error'} (${responseJson.body?.code || 'no code'})`)
        }
      } catch (parseError) {
        // Not JSON or not a problem-report, log as regular error
        if (!(parseError instanceof SyntaxError)) {
          throw parseError // Re-throw if it's our custom error from above
        }
      }

      console.error('HTTP error response:', response.status, response.statusText)
      console.error('Response body:', responseText)
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error sending DIDComm message:', error.message)
    throw error
  }
}

// Message type handlers
async function handleLoginMessage(message, req) {
  console.log('Processing login message...')

  const sessionToken = message.body?.session_token

  if (!sessionToken) {
    console.warn('Login message missing session_token')
    return null
  }

  // In production, validate the session token exists and is active
  // For now, we'll create a simple response

  return {
    type: 'https://didcomm.org/login/1.0/session-authenticated',
    id: crypto.randomUUID(),
    thid: message.id,
    from: SERVER_DID_DATA.did,
    to: [message.from],
    created_time: Math.floor(Date.now() / 1000),
    body: {
      session_token: sessionToken,
      authenticated: true
    }
  }
}

async function handleMediationRequest(message) {
  console.log('Processing mediation request...')

  // This is a simple stub - real mediation requires more complex logic
  return {
    type: 'https://didcomm.org/coordinate-mediation/3.0/mediate-deny',
    id: crypto.randomUUID(),
    thid: message.id,
    from: SERVER_DID_DATA.did,
    to: [message.from],
    created_time: Math.floor(Date.now() / 1000),
    body: {
      reason: 'This server does not provide mediation services'
    }
  }
}

async function handleTrustPing(message) {
  console.log('Processing trust ping...')

  return {
    type: 'https://didcomm.org/trust-ping/2.0/ping-response',
    id: crypto.randomUUID(),
    thid: message.id,
    from: SERVER_DID_DATA.did,
    to: [message.from],
    created_time: Math.floor(Date.now() / 1000),
    body: {}
  }
}

async function handleUserProfileRequest(message) {
  console.log('Processing user profile request...')

  return {
    type: 'https://didcomm.org/user-profile/1.0/profile',
    id: crypto.randomUUID(),
    thid: message.id,
    from: SERVER_DID_DATA.did,
    to: [message.from],
    created_time: Math.floor(Date.now() / 1000),
    body: {
      profile: {
        displayName: 'Example Website'
      }
    }
  }
}

async function handleBasicMessage(message) {
  console.log('Processing basic message:', message.body?.content)

  // Store the message content, no response needed
  return null
}

async function handleOutOfBandInvitation(message) {
  console.log('Processing out-of-band invitation...')

  // Handle OOB invitation acceptance
  return null
}

// API endpoint to retrieve messages for a session
app.get('/api/messages/:sessionToken', (req, res) => {
  const sessionToken = req.params.sessionToken
  const messages = sessionMessageQueue.get(sessionToken) || []

  res.json({
    success: true,
    count: messages.length,
    messages: messages
  })
})

// API endpoint to retrieve all stored messages (for debugging)
app.get('/api/messages', (req, res) => {
  const allMessages = Array.from(messageStore.values())

  res.json({
    success: true,
    count: allMessages.length,
    messages: allMessages
  })
})

// Get server DID endpoint (for clients to discover server identity)
app.get('/api/did', (req, res) => {
  res.json({
    did: SERVER_DID_DATA.did,
    didDocument: SERVER_DID_DATA.didDocument,
    endpoints: {
      didcomm: `http://localhost:${PORT}/didcomm`
    }
  })
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`Express server running on http://localhost:${PORT}`)
  console.log(`Session management enabled with cookie name: ${sessionConfig.name}`)
  console.log(`DIDComm endpoint available at: http://localhost:${PORT}/didcomm`)
  console.log(`Server DID: ${SERVER_DID_DATA.did}`)
  console.log(`Server DID Document available at: http://localhost:${PORT}/api/did`)
})
