import http from "node:http";
import { randomUUID } from "node:crypto";

export type RemoteRangeProxyStats = {
  requestCount: number;
  transferredBytes: number;
};

export type RemoteRangeProxy = {
  inputUrl: string;
  stats: RemoteRangeProxyStats;
  close: () => Promise<void>;
};

export async function createRemoteRangeProxy(sourceUrl: string): Promise<RemoteRangeProxy> {
  const probe = await fetch(sourceUrl, { method: "HEAD", redirect: "follow" });
  if (!probe.ok) throw new Error(`Remote source probe failed with HTTP ${probe.status}`);
  if (probe.headers.get("accept-ranges")?.toLowerCase() !== "bytes") {
    throw new Error("Remote source does not support byte ranges");
  }

  const stats: RemoteRangeProxyStats = { requestCount: 0, transferredBytes: 0 };
  const pendingControllers = new Set<AbortController>();
  const routeToken = randomUUID();
  const server = http.createServer(async (request, response) => {
    if ((request.method !== "GET" && request.method !== "HEAD") || request.url !== `/${routeToken}`) {
      response.writeHead(404).end();
      return;
    }
    const range = request.headers.range;
    if (request.method === "GET" && !range) {
      response.writeHead(416).end();
      return;
    }

    const controller = new AbortController();
    pendingControllers.add(controller);
    response.on("close", () => controller.abort());
    try {
      const upstream = await fetch(sourceUrl, {
        method: request.method,
        headers: range ? { Range: range } : undefined,
        redirect: "follow",
        signal: controller.signal
      });
      if (request.method === "GET" && upstream.status !== 206) {
        controller.abort();
        response.writeHead(502).end();
        return;
      }
      if (!upstream.ok) {
        response.writeHead(502).end();
        return;
      }

      stats.requestCount += 1;
      response.statusCode = upstream.status;
      for (const header of ["accept-ranges", "content-range", "content-length", "content-type"]) {
        const value = upstream.headers.get(header);
        if (value) response.setHeader(header, value);
      }
      if (request.method === "HEAD" || !upstream.body) {
        response.end();
        return;
      }

      for await (const chunk of upstream.body) {
        if (response.destroyed) break;
        stats.transferredBytes += chunk.length;
        if (!response.write(chunk)) {
          await new Promise<void>((resolve) => {
            const done = () => {
              response.off("drain", done);
              response.off("close", done);
              resolve();
            };
            response.once("drain", done);
            response.once("close", done);
          });
        }
      }
      if (!response.destroyed) response.end();
    } catch (error) {
      if (!controller.signal.aborted && !response.headersSent) response.writeHead(502).end();
    } finally {
      pendingControllers.delete(controller);
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Range proxy did not receive a local TCP port");
  }

  return {
    inputUrl: `http://127.0.0.1:${address.port}/${routeToken}`,
    stats,
    close: async () => {
      for (const controller of pendingControllers) controller.abort();
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  };
}
