import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
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
    host_permissions: [
      `${import.meta.env.WXT_BETTER_AUTH_BASE_URL || 'http://localhost:3000'}/*`,
    ],
    permissions: ['storage'],
  }),
});
