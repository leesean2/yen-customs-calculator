/* 서비스워커 — ① 오프라인 캐싱(PWA) ② 웹 푸시 수신
   Vite가 자산 파일명을 해시하므로 프리캐시 목록 대신 런타임 캐싱을 쓴다. */

const CACHE = "yen-calc-v1";

/* ── 오프라인 캐싱 ── */
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // 앱 셸 + 해시된 자산을 설치 시점에 프리캐시 — 첫 방문의 자산 요청은
      // 서비스워커가 페이지를 제어하기 전에 끝나 런타임 캐시에 잡히지 않으므로,
      // 이게 없으면 '첫 방문 직후 오프라인'에서 JS가 없어 빈 화면이 된다.
      const c = await caches.open(CACHE);
      const res = await fetch("/");
      const html = await res.text();
      const assets = [...new Set([...html.matchAll(/\/assets\/[^"']+/g)].map((m) => m[0]))];
      await c.put("/", new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } }));
      await c.addAll([...assets, "/manifest.webmanifest", "/icon-192.png"]);
      await self.skipWaiting();
    })()
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

  // ignoreVary: 해시 자산은 crossorigin(CORS) 모듈로 요청되는데, 프리캐시 때와
  // 요청 헤더가 달라 Vary 헤더 때문에 match가 미스날 수 있다 — URL만으로 매칭한다
  const matchOpts = { ignoreVary: true };

  // 페이지 이동: network-first — 새 배포를 우선 받고, 오프라인이면 캐시된 앱 셸
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          // 오류 응답(5xx 등)을 앱 셸로 저장하면 오프라인 화면이 오염된다
          if (res.ok) {
            const c = await caches.open(CACHE);
            c.put("/", res.clone());
          }
          return res;
        } catch {
          return (await caches.match("/", matchOpts)) || Response.error();
        }
      })()
    );
    return;
  }

  // 정적 자산: cache-first — /assets/*는 파일명이 해시라 영구 캐시해도 안전
  event.respondWith(
    (async () => {
      const cached = await caches.match(req, matchOpts);
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
