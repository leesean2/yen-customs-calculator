/* 서비스워커 — ① 오프라인 캐싱(PWA) ② 웹 푸시 수신
   Vite가 자산 파일명을 해시하므로 프리캐시 목록 대신 런타임 캐싱을 쓴다. */

const CACHE = "yen-calc-v1";

/* ── 오프라인 캐싱 ── */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(["/"])).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 외부(환율 API 등)는 앱이 자체 캐시로 처리
  if (url.pathname.startsWith("/api/")) return;    // 서버리스 API는 네트워크 전용

  // 페이지 이동: network-first — 새 배포를 우선 받고, 오프라인이면 캐시된 앱 셸
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          const c = await caches.open(CACHE);
          c.put("/", res.clone());
          return res;
        } catch {
          return (await caches.match("/")) || Response.error();
        }
      })()
    );
    return;
  }

  // 정적 자산: cache-first — /assets/*는 파일명이 해시라 영구 캐시해도 안전
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      if (
        res.ok &&
        (url.pathname.startsWith("/assets/") ||
          ["style", "script", "image", "font", "manifest"].includes(req.destination))
      ) {
        const c = await caches.open(CACHE);
        c.put(req, res.clone());
      }
      return res;
    })()
  );
});

/* ── 웹 푸시 ── */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: "엔화 계산기", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "엔화 계산기 알림", {
      body: data.body || "",
      data: { url: data.url || "/" },
      icon: "/icon-192.png",
      lang: "ko",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});
