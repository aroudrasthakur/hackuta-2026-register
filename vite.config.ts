import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import istanbul from 'vite-plugin-istanbul'
import { contentSecurityPolicy } from './security/csp.ts'
import { permissionsPolicy, referrerPolicy } from './security/headers.ts'

const instrumentForCoverage = process.env.VITE_COVERAGE === 'true'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    instrumentForCoverage &&
      istanbul({
        include: ['src/**/*', 'shared/**/*', 'convex/**/*', 'security/**/*'],
        exclude: ['**/*.test.*', '**/*.spec.*', 'node_modules/**', 'tests/**', 'convex/_generated/**'],
        extension: ['.js', '.ts', '.tsx'],
        requireEnv: false,
        forceBuildInstrument: true,
      }),
  ].filter(Boolean),
  server: { port: 5273, strictPort: true },
  preview: {
    port: 4274,
    strictPort: true,
    headers: {
      'Content-Security-Policy': contentSecurityPolicy,
      'Permissions-Policy': permissionsPolicy,
      'Referrer-Policy': referrerPolicy,
    },
  },
  build: { target: 'es2022' },
})
