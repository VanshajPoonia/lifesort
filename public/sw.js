// LifeSort service worker. Pages always come from the network, with an offline page
// as the fallback. Next's hashed static files are cached. API data is never cached.
const STATIC_CACHE = "lifesort-static-v1"
const OFFLINE_CACHE = "lifesort-offline-v1"
const OFFLINE_URL = "/offline.html"
const MAX_STATIC_ENTRIES = 150

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icon-192.png"]))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  const keep = new Set([STATIC_CACHE, OFFLINE_CACHE])
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error()),
    )
    return
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request))
  }
})

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE)
    await cache.put(request, response.clone())
    await trimCache(cache)
  }
  return response
}

// Old builds leave hashed files behind, so keep only the newest entries.
async function trimCache(cache) {
  const keys = await cache.keys()
  const extra = keys.length - MAX_STATIC_ENTRIES
  for (const key of keys.slice(0, Math.max(0, extra))) await cache.delete(key)
}
