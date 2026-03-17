import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  webExt: {
    chromiumArgs: ['--user-data-dir=./.wxt/chrome-data'],
  },
  manifest: () => ({
    host_permissions: [
      `${import.meta.env.WXT_BETTER_AUTH_BASE_URL || 'http://localhost:3000'}/*`,
    ],
    permissions: ['storage'],
  }),
});
