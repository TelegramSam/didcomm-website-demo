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
  const packedMessage = req.body

  console.log('=== Received DIDComm message on /didcomm ===')
  console.log('Raw message:', JSON.stringify(packedMessage, null, 2))

  try {
    // Step 1: Unpack (decrypt) the message
    let message, metadata
    try {
      const unpacked = await unpackMessage(packedMessage)
      message = unpacked.message
      metadata = unpacked.metadata

      console.log('=== Unpacked DIDComm message ===')
      console.log('Message type:', message.type)
      console.log('Message ID:', message.id)
      console.log('From:', message.from)
      console.log('To:', message.to)
      console.log('Encrypted:', metadata.encrypted)
      console.log('Authenticated:', metadata.authenticated)
      console.log('Full message:', JSON.stringify(message, null, 2))
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
    messageRecord.response = responseMessage

    // Queue message for session if session token is in body
    if (message.body?.session_token) {
      const sessionToken = message.body.session_token
      if (!sessionMessageQueue.has(sessionToken)) {
        sessionMessageQueue.set(sessionToken, [])
      }
      sessionMessageQueue.get(sessionToken).push(messageRecord)
    }

    // Send response
    if (responseMessage) {
      res.status(200).json(responseMessage)
    } else {
      res.status(200).json({
        status: 'received',
        message_id: message.id
      })
    }
  } catch (error) {
    console.error('Error processing DIDComm message:', error)
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    })
  }
})

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
    from: message.to?.[0] || 'server-did',
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
    from: message.to?.[0] || 'server-did',
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
    from: message.to?.[0] || 'server-did',
    to: [message.from],
    created_time: Math.floor(Date.now() / 1000),
    body: {}
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
