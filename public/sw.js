// PROTECT System — Tile Caching Service Worker
const TILE_CACHE = 'protect-tiles-v1'
const TILE_HOST = /^https:\/\/[abc]\.tile\.openstreetmap\.org/

// Store tiles with a normalized key (no subdomain) so all subdomain requests hit the same cache entry
function normalizeUrl(url) {
  return url.replace(/^https:\/\/[abc]\.tile\.openstreetmap\.org/, 'https://tile.openstreetmap.org')
}

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(clients.claim()))

// Cache-first for tiles; network-first fallback to cache when offline
self.addEventListener('fetch', e => {
  if (!TILE_HOST.test(e.request.url)) return
  const cacheKey = normalizeUrl(e.request.url)
  e.respondWith(
    caches.open(TILE_CACHE).then(cache =>
      cache.match(cacheKey).then(hit => {
        if (hit) return hit
        return fetch(e.request).then(res => {
          if (res.ok) cache.put(cacheKey, res.clone())
          return res
        }).catch(() => new Response('', { status: 503, statusText: 'Offline' }))
      })
    )
  )
})

// Handle messages from the app
self.addEventListener('message', async e => {
  if (e.data?.type === 'PRECACHE_TILES') {
    const { tiles } = e.data
    const cache = await caches.open(TILE_CACHE)
    const sub = ['a', 'b', 'c']
    let done = 0

    for (const { z, x, y } of tiles) {
      const cacheKey = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
      if (!(await cache.match(cacheKey))) {
        try {
          const res = await fetch(`https://${sub[done % 3]}.tile.openstreetmap.org/${z}/${x}/${y}.png`)
          if (res.ok) await cache.put(cacheKey, res)
        } catch (_) { /* skip failed tile */ }
      }
      done++
      // Report progress every 10 tiles
      if (done % 10 === 0 || done === tiles.length) {
        e.source?.postMessage({ type: 'PRECACHE_PROGRESS', done, total: tiles.length })
      }
    }
    e.source?.postMessage({ type: 'PRECACHE_DONE', total: tiles.length })
  }

  if (e.data?.type === 'GET_TILE_COUNT') {
    const cache = await caches.open(TILE_CACHE)
    const keys = await cache.keys()
    e.source?.postMessage({ type: 'TILE_COUNT', count: keys.length })
  }

  if (e.data?.type === 'CLEAR_TILES') {
    await caches.delete(TILE_CACHE)
    e.source?.postMessage({ type: 'TILES_CLEARED' })
  }
})
