// Express.js server with session management for DIDComm login
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import cookieParser from 'cookie-parser';

const app = express();
const PORT = 3000;

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
};

// Middleware
app.use(cors({
  origin: 'https://localhost:5173', // Vite dev server
  credentials: true // Allow cookies to be sent
}));
app.use(cookieParser());
app.use(express.json());
app.use(session(sessionConfig));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, {
    sessionID: req.sessionID,
    hasSession: !!req.session
  });
  next();
});

// API endpoint to get session token
app.get('/api/session', (req, res) => {
  // Express-session automatically creates a session if one doesn't exist
  const sessionToken = req.sessionID;

  // Store session creation time if not already set
  if (!req.session.createdAt) {
    req.session.createdAt = Date.now();
  }

  res.json({
    success: true,
    sessionToken: sessionToken,
    createdAt: req.session.createdAt,
    cookie: req.session.cookie
  });
});

// API endpoint to receive DIDComm session-login messages
app.post('/api/didcomm/session-login', (req, res) => {
  const message = req.body;
  console.log('Received DIDComm session-login message:', message);

  // Extract session token from message body
  const sessionTokenFromWallet = message.body?.session_token;

  if (!sessionTokenFromWallet) {
    return res.status(400).json({
      success: false,
      error: 'Missing session_token in message body'
    });
  }

  // In a real implementation, you would:
  // 1. Validate the session token matches an active browser session
  // 2. Verify the DID and signature
  // 3. Associate the wallet DID with the browser session
  // 4. Mark the session as authenticated

  console.log('Session token from wallet:', sessionTokenFromWallet);
  console.log('Current request session ID:', req.sessionID);

  // Store wallet connection in session
  req.session.walletDID = message.from;
  req.session.authenticated = true;
  req.session.authenticatedAt = Date.now();

  res.json({
    success: true,
    message: 'Session login received',
    sessionToken: req.sessionID
  });
});

// API endpoint to send session-connected message
app.post('/api/didcomm/session-connected', (req, res) => {
  const { walletDID } = req.body;

  if (!req.session.authenticated) {
    return res.status(401).json({
      success: false,
      error: 'Session not authenticated'
    });
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
  };

  console.log('Sending session-connected message:', sessionConnectedMessage);

  res.json({
    success: true,
    message: sessionConnectedMessage
  });
});

// Check session authentication status
app.get('/api/session/status', (req, res) => {
  res.json({
    authenticated: !!req.session.authenticated,
    walletDID: req.session.walletDID,
    sessionID: req.sessionID,
    createdAt: req.session.createdAt,
    authenticatedAt: req.session.authenticatedAt
  });
});

// Destroy session (logout)
app.post('/api/session/destroy', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: 'Failed to destroy session'
      });
    }
    res.clearCookie('didcomm.sid');
    res.json({
      success: true,
      message: 'Session destroyed'
    });
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Express server running on http://localhost:${PORT}`);
  console.log(`Session management enabled with cookie name: ${sessionConfig.name}`);
});
