/**
 * 푸시 구독 저장소 — Vercel Blob(private), 구독 1건당 파일 1개(subs/<hash>.json)
 *
 * 단일 파일(read-modify-write) 방식은 두 가지 문제로 폐기:
 * 1) Blob은 같은 경로를 덮어써도 CDN 캐시 때문에 읽기가 한동안 이전 내용을 반환
 * 2) 동시 구독 시 마지막 쓰기가 다른 구독을 유실
 * 파일 분리로 등록/삭제가 읽기 없이 원자적이 된다. list()의 최대 1분 지연은
 * 하루 1회 크론에는 무해하다.
 */
import { put, del, list } from "@vercel/blob";
import { createHash } from "node:crypto";

const PREFIX = "subs/";

const keyOf = (endpoint) =>
  PREFIX + createHash("sha256").update(endpoint).digest("hex").slice(0, 40) + ".json";

export async function saveSub(record) {
  await put(keyOf(record.subscription.endpoint), JSON.stringify(record), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

export async function deleteSub(endpoint) {
  await del(keyOf(endpoint));
}

export async function countSubs() {
  const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
  return blobs.length;
}

export async function readSubs() {
  const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
  const results = await Promise.all(
    blobs.map(async (b) => {
      try {
        // ?ts= 로 CDN 캐시를 우회해 항상 최신 내용을 읽는다
        const r = await fetch(`${b.url}?ts=${Date.now()}`, {
          cache: "no-store",
          headers: { authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
        });
        return r.ok ? await r.json() : null;
      } catch {
        return null;
      }
    })
  );
  return results.filter((s) => s?.subscription?.endpoint);
}
