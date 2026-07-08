/**
 * 푸시 구독 저장소 — Vercel Blob(private)에 JSON 파일 하나로 관리
 * 트래픽이 낮은 개인 프로젝트라 파일 하나 읽고-쓰기로 충분하다.
 * (동시 쓰기 경합 시 마지막 쓰기가 이기지만, 구독/해제 빈도상 허용)
 */
import { put, list } from "@vercel/blob";

const FILE = "push-subs.json";

export async function readSubs() {
  try {
    const { blobs } = await list({ prefix: FILE });
    const b = blobs.find((x) => x.pathname === FILE);
    if (!b) return [];
    const r = await fetch(b.url, {
      cache: "no-store",
      headers: { authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    });
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function writeSubs(subs) {
  await put(FILE, JSON.stringify(subs), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}
