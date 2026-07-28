import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createRemoteRangeProxy } from "./remoteRangeProxy";

async function listen(server: http.Server) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server has no TCP port");
  return `http://127.0.0.1:${address.port}/video.mp4`;
}

async function close(server: http.Server) {
  server.closeAllConnections?.();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

test("forwards byte ranges and records transferred bytes", async () => {
  const source = Buffer.from("abcdefghijklmnopqrstuvwxyz");
  const upstream = http.createServer((request, response) => {
    response.setHeader("accept-ranges", "bytes");
    response.setHeader("content-type", "video/mp4");
    if (request.method === "HEAD") {
      response.setHeader("content-length", source.length);
      response.end();
      return;
    }
    const match = /^bytes=(\d+)-(\d+)$/.exec(request.headers.range ?? "");
    if (!match) {
      response.writeHead(416).end();
      return;
    }
    const start = Number(match[1]);
    const end = Number(match[2]);
    const body = source.subarray(start, end + 1);
    response.writeHead(206, {
      "content-length": body.length,
      "content-range": `bytes ${start}-${end}/${source.length}`
    });
    response.end(body);
  });
  const sourceUrl = await listen(upstream);
  const proxy = await createRemoteRangeProxy(sourceUrl);

  try {
    const response = await fetch(proxy.inputUrl, { headers: { Range: "bytes=5-9" } });
    assert.equal(response.status, 206);
    assert.equal(await response.text(), "fghij");
    assert.equal(proxy.stats.requestCount, 1);
    assert.equal(proxy.stats.transferredBytes, 5);
  } finally {
    await proxy.close();
    await close(upstream);
  }
});

test("rejects sources without byte-range support", async () => {
  const upstream = http.createServer((_request, response) => response.writeHead(200).end());
  const sourceUrl = await listen(upstream);
  try {
    await assert.rejects(() => createRemoteRangeProxy(sourceUrl), /does not support byte ranges/);
  } finally {
    await close(upstream);
  }
});
