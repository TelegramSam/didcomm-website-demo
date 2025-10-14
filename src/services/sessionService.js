// Browser Session Management Service
// Integrates with Express.js backend session management

const API_BASE_URL = '/api'

/**
 * Get session token from Express backend
 * This fetches the server-managed session token (express-session)
 * @returns {Promise<string>} The session token
 */
export async function getSessionToken() {
  try {
    const response = await fetch(`${API_BASE_URL}/session`, {
      method: 'GET',
      credentials: 'include' // Important: include cookies for session management
    })

    if (!response.ok) {
      throw new Error(`Failed to get session: ${response.statusText}`)
    }

    const data = await response.json()
    console.log('Got session token from Express server:', data.sessionToken)

    return data.sessionToken
  } catch (error) {
    console.error('Error fetching session token from Express:', error)
    // Fallback to client-side session if server is unavailable
    return getFallbackSessionToken()
  }
}

/**
 * Fallback session token generation (client-side only)
 * Used if Express server is unavailable
 * @returns {string}
 */
function getFallbackSessionToken() {
  const SESSION_STORAGE_KEY = 'fallback_session_id'

  let sessionToken = localStorage.getItem(SESSION_STORAGE_KEY)

  if (!sessionToken) {
    sessionToken = generateSessionToken()
    localStorage.setItem(SESSION_STORAGE_KEY, sessionToken)
    console.log('Created fallback client-side session:', sessionToken)
  } else {
    console.log('Using existing fallback session:', sessionToken)
  }

  return sessionToken
}

/**
 * Generate a cryptographically secure session token
 * Format: timestamp-random-random (similar to Rails/Express session tokens)
 * @returns {string}
 */
function generateSessionToken() {
  const timestamp = Date.now().toString(36)
  const random1 = crypto.randomUUID().replace(/-/g, '')
  const random2 = crypto.randomUUID().replace(/-/g, '')
  return `${timestamp}-${random1.substring(0, 16)}-${random2.substring(0, 16)}`
}

/**
 * Get session status from backend
 * @returns {Promise<object>} Session status including authentication state
 */
export async function getSessionStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/session/status`, {
      method: 'GET',
      credentials: 'include'
    })

    if (!response.ok) {
      throw new Error(`Failed to get session status: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching session status:', error)
    return { authenticated: false, error: error.message }
  }
}

/**
 * Clear/destroy the server session
 * @returns {Promise<object>} Result of session destruction
 */
export async function clearSession() {
  try {
    const response = await fetch(`${API_BASE_URL}/session/destroy`, {
      method: 'POST',
      credentials: 'include'
    })

    if (!response.ok) {
      throw new Error(`Failed to destroy session: ${response.statusText}`)
    }

    const result = await response.json()
    console.log('Session destroyed on server')

    // Also clear fallback session
    localStorage.removeItem('fallback_session_id')

    return result
  } catch (error) {
    console.error('Error destroying session:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get session information (compatibility wrapper)
 * @returns {Promise<object|null>} Session info
 */
export async function getSessionInfo() {
  return await getSessionStatus()
}

/**
 * Renew the session (makes a request to keep session alive)
 * @returns {Promise<void>}
 */
export async function renewSession() {
  try {
    await fetch(`${API_BASE_URL}/session`, {
      method: 'GET',
      credentials: 'include'
    })
    console.log('Session renewed')
  } catch (error) {
    console.error('Error renewing session:', error)
  }
}
