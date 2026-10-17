import { defineConfig } from 'vite';
import { localPhotos } from './server/google-photos.js';
import { localTodoist } from './server/todoist.js';
import { googleCalendar } from './server/google-calendar.js';
import { bomObservations } from './server/bom.js';
import { chatgptUsage } from './server/chatgpt-usage.js';

// The wall tablet runs Android WebView 106 — keep JS output within Chromium 106.
// CSS targets chrome61 on purpose: the tablet's WebView rejects 4/8-digit hex colours (#0000,
// #ffffffbf) even though Chrome 106 should support them, and a newer target lets the minifier
// rewrite transparent/rgba() into that form. Verified on-device with CSS.supports().
export default defineConfig({
  plugins: [localPhotos(), bomObservations(), googleCalendar(), chatgptUsage(), localTodoist()],
  build: {
    target: 'chrome106',
    cssTarget: 'chrome61',
  },
  server: { host: '127.0.0.1', fs: { deny: ['**/.private/**', '**/.env*', '**/*.{crt,pem}', '**/.git/**'] } },
  preview: { host: '127.0.0.1' },
});
