import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  dev: {
    server: { port: 5173 },
  },
  webExt: {
    chromiumArgs: [
      '--user-data-dir=./.wxt/chrome-data', // Persistent dev profile (logins, extensions, etc.)
      '--disable-blink-features=AutomationControlled', // Fixes Google "browser may not be secure" sign-in block
    ],
  },
  manifest: () => ({
    name: 'ThinkEx-Extension',
    host_permissions: [
      `${import.meta.env.WXT_BETTER_AUTH_BASE_URL || 'http://localhost:3000'}/*`,
      'https://*/*',
    ],
    permissions: ['storage'],
    web_accessible_resources: [
      {
        resources: ['callback.html'],
        matches: [
          `${import.meta.env.WXT_BETTER_AUTH_BASE_URL || 'http://localhost:3000'}/*`,
          'https://thinkex.app/*',
        ],
      },
      {
        resources: ['ThinkExLogo.svg'],
        matches: ['https://*/*'],
      },
    ],
  }),
});
