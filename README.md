# DIDComm v2 QR Code Scanner

## Project Overview

A simple QR code scanning web application for DIDComm v2 decentralized identity communication. This is a single-page Vue.js application with client-side DIDComm processing.

## Features
- Vue.js single-page application
- QR code scanning capabilities
- Client-side DIDComm v2 message handling
- Lightweight - no backend required

## Tech Stack

- **Vue 3** with Composition API
- **Vite** - Fast build tooling and development server
- **vue-qrcode-reader** - QR code scanning with camera access
- **Axios** - HTTP client for API communication

## Getting Started

### Install Dependencies

```sh
npm install
```

### Run Development Server

```sh
npm run dev
```

The application will be available at http://localhost:5173 (or the next available port).

### Build for Production

```sh
npm run build
```

The built files will be in the `dist/` folder, ready to deploy to any static web host.

## Project Structure

```
didcomm-website-demo/
├── src/
│   ├── main.ts           # Application entry point
│   ├── App.vue           # Root component
│   └── components/
│       └── QrScanner.vue # QR code scanner component
├── public/               # Static assets
├── index.html           # HTML entry point
├── package.json         # Dependencies
├── vite.config.ts       # Vite configuration
└── README.md
```

## Development

This is a client-side only application. All DIDComm processing happens in the browser, making it easy to deploy and maintain.
