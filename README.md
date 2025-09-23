# DIDComm v2 QR Code Scanner - Project Specification

## Project Overview

A cost-effective QR code scanning application that integrates DIDComm v2 for decentralized identity communication. The project emphasizes minimal effort, simplicity, and cost-effective deployment while supporting both local development and production deployment.

## Project Outline

### Core Functionality
- **Frontend**: Vue.js application with QR code scanning capabilities for DIDComm messages/invitations
- **Backend**: Python API with DIDComm v2 message processing and routing
- **DIDComm Integration**: Handle connection establishment and secure message exchange
- **Deployment**: Local development environment with simple web server deployment options

### Key Features
- Real-time QR code scanning for DIDComm invitations and messages
- DIDComm v2 message pack/unpack operations
- Connection management and persistence
- Message routing and protocol handling
- RESTful API for frontend-backend communication

## Tech Stack

### Frontend
- **Vue 3** with Composition API - Modern, reactive framework
- **Vite** - Fast build tooling and development server
- **vue-qrcode-reader** - QR code scanning plugin with camera access
- **@sicpa-dlab/didcomm-js** - JavaScript DIDComm v2 implementation
- **Axios** - HTTP client for API communication

### Backend
- **FastAPI** (Python) - Lightweight, high-performance API framework with auto-generated documentation
- **didcomm** (Python) - Official DIDComm v2 library for message processing
- **SQLite** - File-based database for zero-configuration data persistence
- **Uvicorn** - ASGI server for serving the FastAPI application

### Database & Storage
- **SQLite** - Stores DIDComm connections, messages, and application state
- **File-based key storage** - Simple key management for development

### Development & Deployment

#### Local Development
- **Frontend**: `npm run dev` with Vite development server
- **Backend**: `uvicorn main:app --reload` for hot-reloading Python API
- **Database**: SQLite file created automatically

#### Production Deployment
- **Static Frontend**: Vue build served via web server (Nginx/Apache)
- **Python Backend**: FastAPI app on VPS or cloud provider
- **Database**: SQLite file or upgrade to PostgreSQL for scale
- **Hosting**: Compatible with budget VPS providers (~$5-10/month)

#### Optional Containerization
- **Docker** support for consistent deployment across environments
- Simplified dependency management for DIDComm libraries

## DIDComm v2 Integration

### Libraries
- **Backend**: `didcomm` - Official Python DIDComm v2 implementation
- **Frontend**: `@sicpa-dlab/didcomm-js` - JavaScript DIDComm v2 client library

### DIDComm Features
- **DID Resolution**: Support for web, key, and peer DID methods
- **Message Encryption**: JWE-based message encryption and decryption
- **Protocol Support**: Connection establishment, basic messaging
- **Key Management**: Secure storage and retrieval of cryptographic keys
- **Message Threading**: Support for message threading and correlation

## Architecture Benefits

### Cost Effectiveness
- **Minimal Infrastructure**: SQLite eliminates database server costs
- **Lightweight Stack**: FastAPI and Vue minimize resource requirements
- **Simple Deployment**: Can run on basic shared hosting or low-cost VPS

### Development Efficiency
- **Fast Development**: Vite provides instant hot-reloading
- **Auto Documentation**: FastAPI generates interactive API docs
- **Minimal Setup**: Few dependencies and configuration files

### Scalability Considerations
- **Database Migration Path**: Easy upgrade from SQLite to PostgreSQL
- **Horizontal Scaling**: Stateless API design supports load balancing
- **Container Ready**: Docker support for orchestrated deployments

## Next Steps

1. **Environment Setup**: Initialize Vue frontend and FastAPI backend projects
2. **DIDComm Integration**: Configure DIDComm libraries and basic message handling
3. **QR Code Implementation**: Integrate camera access and QR scanning
4. **API Development**: Create endpoints for DIDComm message processing
5. **Connection Flow**: Implement DIDComm connection establishment protocol
6. **Testing & Deployment**: Local testing and production deployment setup