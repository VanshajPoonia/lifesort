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

// Push reminders sent by lib/push.ts. The payload is { title, body, url, tag }.
self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : "" }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "LifeSort", {
      body: data.body || "",
      icon: "/icon-192.png",
      tag: data.tag,
      data: { url: data.url || "/" },
    }),
  )
})

// Opens LifeSort at the reminder's page, reusing an open window when there is one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || "/", self.location.origin)
  const url = target.origin === self.location.origin ? target.href : self.location.origin + "/"
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin)
      if (open) {
        await open.focus()
        // navigate() rejects for a window this worker doesn't control yet.
        const navigated = "navigate" in open ? await open.navigate(url).catch(() => null) : null
        if (navigated) return
      }
      await self.clients.openWindow(url)
    })(),
  )
})
