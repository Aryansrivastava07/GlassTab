// Manifest V3 Background Service Worker
// Provides CORS-free background fetching with TTL caching for Custom Widgets

const FETCH_CACHE_PREFIX = 'widget_fetch_cache_';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'WIDGET_SPEED_TEST') {
    (async () => {
      try {
        const t0 = performance.now();
        await fetch('https://www.cloudflare.com/cdn-cgi/trace', { cache: 'no-store' });
        const pingMs = Math.round(performance.now() - t0);

        let downloadMbps = null;
        if (message.activeTest !== false) {
          const bytes = Math.min(2000000, Math.max(100000, Number(message.bytes) || 500000));
          const d0 = performance.now();
          const dlRes = await fetch(`https://speed.cloudflare.com/__down?bytes=${bytes}`, {
            cache: 'no-store',
          });
          await dlRes.arrayBuffer();
          const elapsedSec = Math.max(0.02, (performance.now() - d0) / 1000);
          downloadMbps = Number(((bytes * 8) / elapsedSec / 1_000_000).toFixed(2));
        }

        sendResponse({ ok: true, pingMs, downloadMbps, measuredAt: Date.now() });
      } catch (err) {
        sendResponse({ ok: false, error: err?.message || 'Speed test failed' });
      }
    })();
    return true;
  }

  if (message?.type !== 'WIDGET_FETCH') return false;

  const { url, options = {} } = message;
  const {
    method = 'GET',
    headers = {},
    body = undefined,
    cacheTtlMs = 45000, // Default 45s shared cache so multiple new tabs load at 0ms
  } = options;

  const cacheKey = `${FETCH_CACHE_PREFIX}${method}_${url}`;

  (async () => {
    try {
      // 1. Return cached response immediately if still fresh (only for GET requests)
      if (method.toUpperCase() === 'GET' && cacheTtlMs > 0) {
        const stored = await chrome.storage.local.get(cacheKey);
        const cached = stored?.[cacheKey];
        if (cached && Date.now() - cached.fetchedAt < cacheTtlMs) {
          sendResponse({
            ok: true,
            status: cached.status || 200,
            text: cached.text,
            contentType: cached.contentType || '',
            fromCache: true,
            fetchedAt: cached.fetchedAt,
          });
          return;
        }
      }

      // 2. Execute CORS-free fetch from Service Worker
      const res = await fetch(url, {
        method,
        headers,
        body: method.toUpperCase() === 'GET' ? undefined : body,
      });

      const text = await res.text();
      const contentType = res.headers.get('content-type') || '';
      const fetchedAt = Date.now();

      if (res.ok && method.toUpperCase() === 'GET' && cacheTtlMs > 0 && text.length < 450000) {
        chrome.storage.local
          .set({
            [cacheKey]: {
              status: res.status,
              text,
              contentType,
              fetchedAt,
            },
          })
          .catch(() => {});
      }

      sendResponse({
        ok: res.ok,
        status: res.status,
        text,
        contentType,
        fromCache: false,
        fetchedAt,
      });
    } catch (err) {
      // Fallback to stale cache if offline
      if (method.toUpperCase() === 'GET') {
        try {
          const stored = await chrome.storage.local.get(cacheKey);
          const stale = stored?.[cacheKey];
          if (stale) {
            sendResponse({
              ok: true,
              status: stale.status || 200,
              text: stale.text,
              contentType: stale.contentType || '',
              fromCache: true,
              stale: true,
              fetchedAt: stale.fetchedAt,
            });
            return;
          }
        } catch {
          // ignore
        }
      }

      sendResponse({
        ok: false,
        status: 0,
        error: err?.message || 'Background fetch failed',
      });
    }
  })();

  return true; // Keep message channel open for async sendResponse
});
