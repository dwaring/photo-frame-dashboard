// Bootstrap deployment only: intentionally has no assets or service bindings.
export default {
  async fetch() {
    return new Response('Dashboard setup in progress. Private dashboard access is not configured yet.\n', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  },
};
