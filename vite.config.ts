import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    define: {
      // Esto permite que el código siga usando process.env.API_KEY y process.env.RESEND_API_KEY
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env.RESEND_API_KEY': JSON.stringify(env.RESEND_API_KEY)
    }
  };
});