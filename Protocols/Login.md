# Website Login Protocol 1.0

## Summary

A secure, passwordless authentication protocol that enables users to login to websites using DIDComm-enabled wallet applications. The protocol establishes a trusted session between a website and a user's wallet through cryptographic verification of DIDs and secure message exchange.

## Motivation

Traditional web authentication relies on usernames, passwords, and session cookies, which have well-documented security vulnerabilities including phishing, credential stuffing, and session hijacking. The Website Login Protocol leverages decentralized identifiers and DIDComm messaging to provide:

- **Passwordless authentication**: Users authenticate using cryptographic keys controlled by their wallet
- **Phishing resistance**: No shared secrets that can be intercepted or stolen
- **Privacy preservation**: Users control which identity information to share
- **Cross-device support**: Scan QR codes to login from mobile wallets
- **Decentralized trust**: No central authentication server required

## Roles

**Website (Authenticator)**: The service requesting user authentication. Displays its DID via QR code or deep link, validates the user's response, and establishes an authenticated session.

**Wallet (User Agent)**: The user's DIDComm-capable application that holds their DIDs and cryptographic keys. Scans the QR code containing the website's DID, creates a connection-specific DID, and responds with authentication credentials.

## Protocol Type URI

`https://didcomm.org/login/1.0`

## States

### Website States

- **qr_displayed**: Website generates and displays QR code with its DID
- **awaiting_session_login**: Website is waiting for the wallet to send session-login message
- **validating**: Website is verifying the authentication response
- **authenticated**: User has been successfully authenticated
- **rejected**: Authentication failed or was rejected
- **expired**: Login session has exceeded its validity period

### Wallet States

- **qr_scanned**: Wallet has scanned the QR code containing website's DID
- **connection_creating**: Wallet is generating a new DID for this connection
- **registering_mediator**: Wallet is registering the new DID with a mediator
- **responding**: Wallet is sending authentication response
- **authenticated**: Login successful, authenticated session established
- **error**: Authentication process failed

## QR Code Invitation

The protocol is initiated when a website displays a QR code containing an Out-of-Band invitation. This invitation serves as the entry point for the wallet to establish a DIDComm connection and begin the login process.

### Invitation Structure

The QR code encodes a URL containing an Out-of-Band invitation with the following structure:

```json
{
  "type": "https://didcomm.org/out-of-band/2.0/invitation",
  "id": "a1b2c3d4-5e6f-7g8h-9i0j-k1l2m3n4o5p6",
  "from": "did:peer:4zQmabcdef...",
  "body": {
    "goal_code": "login",
    "goal": "To login to the website",
    "accept": ["didcomm/v2"]
  },
  "created_time": 1704067200,
  "expires_time": 1704070800
}
```

**URL Format**: The invitation is encoded as a URL parameter:

```
https://example.com/login?_oob={url-encoded-invitation-json}
```

### Goal Code

The `goal_code` field MUST be set to `"login"` to indicate this invitation is for website authentication. This allows wallets to:

- Recognize the invitation as a login request
- Apply appropriate security policies
- Display relevant UI to the user (e.g., "Login to website")
- Initiate the session-login protocol flow

### Session Token in Invitation

Websites MAY include a session identifier or token in the invitation to track login attempts and correlate the QR code scan with a specific browser session:

```json
{
  "type": "https://didcomm.org/out-of-band/2.0/invitation",
  "id": "a1b2c3d4-5e6f-7g8h-9i0j-k1l2m3n4o5p6",
  "from": "did:peer:4zQmabcdef...",
  "body": {
    "goal_code": "login",
    "goal": "To login to the website",
    "accept": ["didcomm/v2"],
    "session_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

When a session token is present in the invitation:

1. **Browser Session Correlation**: The wallet SHOULD include this token in the session-login message to allow the website to identify which browser session initiated the login
2. **Security**: The token acts as a nonce to prevent QR code reuse and helps detect potential replay attacks
3. **Expiration**: The invitation's `expires_time` field limits the validity window of the embedded session token
4. **Uniqueness**: Each QR code generation SHOULD create a unique session token to track individual login attempts

### Wallet Processing

When a wallet scans the QR code invitation:

1. Parse the `_oob` parameter from the URL
2. Validate the invitation structure and `goal_code` field
3. Extract the website's DID from the `from` field
4. Extract any embedded `session_token` from the body
5. Create a new DID for this connection
6. Register the new DID with the configured mediator
7. Send a session-login message to the website's DID, including the session token if present

## Messages

### 1. Session Login

Sent by the wallet to initiate the login process after scanning the QR code.

**Message Type**: `https://didcomm.org/login/1.0/session-login`

```json
{
  "type": "https://didcomm.org/login/1.0/session-login",
  "id": "b2c3d4e5-6f7g-8h9i-0j1k-l2m3n4o5p6q7",
  "from": "did:peer:4zQmxyz123...",
  "to": ["did:peer:4zQmabcdef..."],
  "created_time": 1704067300,
  "body": {
    "session_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Field Descriptions**:

- `from`: The wallet's newly created DID for this connection
- `to`: The website's DID from the scanned QR code
- `session_token`: (Optional) JWT or session token from a previous session for reconnection

### 2. Session Connected

Sent by the website to confirm the authenticated session has been established.

**Message Type**: `https://didcomm.org/login/1.0/session-connected`

```json
{
  "type": "https://didcomm.org/login/1.0/session-connected",
  "id": "c3d4e5f6-7g8h-9i0j-1k2l-m3n4o5p6q7r8",
  "from": "did:peer:4zQmabcdef...",
  "to": ["did:peer:4zQmxyz123..."],
  "thid": "b2c3d4e5-6f7g-8h9i-0j1k-l2m3n4o5p6q7",
  "created_time": 1704067320,
  "body": {}
}
```

**Field Descriptions**:

- `thid`: Thread ID referencing the original session-login message ID

## Protocol Flow

### Login Flow

```
┌─────────┐                  ┌────────┐                                ┌────────┐
│ Browser │                  │Website │                                │ Wallet │
└────┬────┘                  └───┬────┘                                └───┬────┘
     │                           │                                          │
     │  1. Navigate to Login     │                                          │
     │──────────────────────────►│                                          │
     │                           │                                          │
     │  2. QR Code (Website DID) │                                          │
     │◄──────────────────────────│                                          │
     │                           │                                          │
     │                           │          3. Scan QR Code                 │
     │                           │◄─────────────────────────────────────────│
     │                           │                                          │
     │                           │          4. Create New DID               │
     │                           │          5. Register with Mediator       │
     │                           │                                          │
     │                           │          6. Session Login                │
     │                           │◄─────────────────────────────────────────│
     │                           │                                          │
     │                           │  7. Verify DID & Connection              │
     │                           │  8. Create Session                       │
     │                           │                                          │
     │                           │          9. Session Connected            │
     │                           │─────────────────────────────────────────►│
     │                           │                                          │
     │  10. Authenticated        │                                          │
     │◄──────────────────────────│                                          │
     │                           │                                          │
```

## Security Considerations

### DID Authentication

- Wallets MUST create a unique DID for each website connection to prevent correlation
- Websites MUST verify that the `from` DID in the session-login message is valid and properly formatted
- Both parties SHOULD use did:peer:4 long-form DIDs for enhanced security and offline resolution
- Websites SHOULD verify that the DID document can be resolved and contains valid verification methods
- The encrypted nature of DIDComm messages provides authentication through the encryption itself

### Session Management

- Session tokens SHOULD use JWT format with appropriate expiration times
- Websites SHOULD implement session timeout and renewal mechanisms
- Session tokens MUST be transmitted over encrypted channels only
- Websites SHOULD allow users to view and revoke active sessions

### Privacy Protection

- Profile information sharing MUST be optional and user-controlled
- Websites SHOULD only request the minimum necessary user information
- Wallets SHOULD allow users to create pseudonymous profiles for each connection
- Connection DIDs SHOULD NOT be reused across different websites

### Message Security

- All messages MUST be encrypted using DIDComm encryption
- Messages SHOULD include `created_time` to prevent replay attacks
- Websites SHOULD validate message timestamps and reject stale messages
- Both parties SHOULD implement message ordering and duplicate detection

### QR Code Security

- QR codes SHOULD include the website's DID and optionally additional context
- Websites MAY include a session ID or nonce in the QR code URL to track login attempts
- QR codes SHOULD be regenerated periodically if they include session-specific data
- Wallets MUST validate that the DID in the QR code matches the `from` field in subsequent messages

## Implementation Notes

### QR Code Generation

- QR codes SHOULD encode the website's DID, optionally as a URL with an Out-of-Band invitation
- Format: `https://example.com/login?_oob={url-encoded-invitation-json}` where the invitation contains the website's DID
- Alternative format: Direct DID encoding in QR code for simpler implementations
- QR codes SHOULD use error correction level L for better scannability
- Websites MAY refresh QR codes periodically for enhanced security

### Mediator Support

- Wallets SHOULD register new connection DIDs with their configured mediator
- Websites SHOULD support receiving messages through mediators
- Mediator endpoints MUST support DIDComm v2 message forwarding
- Wallets MAY use different mediators for different connections

### Session Establishment

- Websites SHOULD provide both session tokens and redirect URLs
- Mobile wallets SHOULD support deep linking to return to the website
- Desktop websites SHOULD auto-refresh to complete the login
- Websites SHOULD provide visual feedback during the authentication process

### Error Handling

- Both parties SHOULD implement timeout handling for each protocol state
- Wallets SHOULD provide clear error messages to users
- Websites SHOULD log authentication failures for security monitoring
- Both parties SHOULD implement graceful degradation for unsupported features

## Extensibility

### Optional Features

Implementations MAY extend this protocol with additional features:

- **Challenge-response authentication**: Adding an additional challenge step for enhanced security
- **Verifiable credentials**: Requesting specific credentials during login
- **Progressive authentication**: Requesting additional authentication for sensitive operations
- **Device binding**: Associating sessions with specific devices
- **Social recovery**: Allowing account recovery through trusted contacts

### Custom Fields

Implementations MAY add custom fields to message bodies using namespaced keys:

```json
{
  "type": "https://didcomm.org/login/1.0/session-login",
  "body": {
    "example.com:custom_field": "custom_value"
  }
}
```

## References

- [DIDComm Messaging Specification v2.1](https://identity.foundation/didcomm-messaging/spec/v2.1/)
- [Out-of-Band Protocol 2.0](https://didcomm.org/out-of-band/2.0/)
- [Decentralized Identifiers (DIDs) v1.0](https://www.w3.org/TR/did-core/)
- [did:peer Method Specification](https://identity.foundation/peer-did-method-spec/)
- [Coordinate Mediation Protocol 3.0](https://didcomm.org/coordinate-mediation/3.0/)

## License

MIT License

## Version History

- **1.0** (2024-01-01): Initial protocol specification
