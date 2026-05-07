// Daybook service worker
// Cache strategy:
//   - Network-first for HTML (so app updates land on next visit)
//   - Cache-first for icons, manifest, and Google Fonts
// Bump CACHE_VERSION when shipping a new build to evict old caches.

var CACHE_VERSION = "daybook-v1";
var APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", function(e) {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(function(c) {
      // addAll fails the whole install if any one fetch fails.
      // Use individual put so a missing optional asset doesn't break install.
      return Promise.all(APP_SHELL.map(function(url) {
        return fetch(url, { cache: "reload" }).then(function(resp) {
          if (resp && resp.ok) return c.put(url, resp);
        }).catch(function(){});
      }));
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) {
        if (k !== CACHE_VERSION) return caches.delete(k);
      }));
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function(e) {
  var req = e.request;
  if (req.method !== "GET") return;

  var url = req.url;
  var isNav = req.mode === "navigate";
  var isHTML = isNav || url.indexOf("index.html") >= 0 || (req.headers.get("accept") || "").indexOf("text/html") >= 0;

  if (isHTML) {
    // Network-first: try the network, fall back to cache, then to the cached shell as a last resort.
    e.respondWith(
      fetch(req).then(function(resp) {
        if (resp && resp.ok) {
          var copy = resp.clone();
          caches.open(CACHE_VERSION).then(function(c) { c.put(req, copy); });
        }
        return resp;
      }).catch(function() {
        return caches.match(req).then(function(cached) {
          return cached || caches.match("./index.html") || caches.match("./");
        });
      })
    );
    return;
  }

  // Cache-first for everything else (icons, manifest, Google Fonts CSS/woff2).
  e.respondWith(
    caches.match(req).then(function(cached) {
      if (cached) return cached;
      return fetch(req).then(function(resp) {
        if (resp && resp.ok && (url.indexOf("http://") === 0 || url.indexOf("https://") === 0)) {
          var copy = resp.clone();
          caches.open(CACHE_VERSION).then(function(c) { c.put(req, copy); });
        }
        return resp;
      }).catch(function() {
        return cached;
      });
    })
  );
});

// Optional: listen for a "skipWaiting" message so a manual update button could trigger immediate activation.
self.addEventListener("message", function(e) {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});
