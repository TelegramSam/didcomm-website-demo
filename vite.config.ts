import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import mkcert from 'vite-plugin-mkcert';

// Plugin to handle /didcomm endpoint
const didcommPlugin = () => ({
  name: 'didcomm-endpoint',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      if (req.url === '/didcomm' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: any) => {
          body += chunk.toString();
        });
        req.on('end', () => {
          try {
            const message = JSON.parse(body);
            console.log('Received DIDComm message:', message);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              status: 'success',
              message: 'DIDComm message received'
            }));
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              status: 'error',
              message: 'Invalid JSON'
            }));
          }
        });
      } else {
        next();
      }
    });
  }
});

export default defineConfig({
  plugins: [vue(), mkcert(), didcommPlugin()],
  server: {
    https: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  },
});
