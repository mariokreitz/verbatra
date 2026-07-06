import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { contentTypeFor } from "./content-type.js";
import { resolveBoundPort } from "./resolve-bound-port.js";
import { readAsset } from "./static-assets.js";
import type { UiServer, UiServerOptions } from "./types.js";

function defaultAssetsRoot(): URL {
  return new URL("./app/", import.meta.url);
}

async function respondWithAsset(
  assetsRootPath: string,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const requestPath = request.url ?? "/";
  const asset =
    (await readAsset(assetsRootPath, requestPath)) ??
    (await readAsset(assetsRootPath, "/index.html"));
  if (asset === undefined) {
    response.statusCode = 404;
    response.end("Not Found");
    return;
  }
  response.statusCode = 200;
  response.setHeader("Content-Type", contentTypeFor(asset.path));
  response.end(asset.body);
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

/**
 * Starts the local Verbatra Studio server. This scaffold binds a loopback HTTP server and serves
 * the prebuilt SPA from the given (or default) assets root; the request-validation gate, the
 * token check, and the security response headers are added by the server-hardening work this
 * scaffold exists to carry.
 */
export async function startUiServer(options: UiServerOptions = {}): Promise<UiServer> {
  const assetsRoot = options.assetsRoot ?? defaultAssetsRoot();
  const assetsRootPath = fileURLToPath(assetsRoot);

  const server = createServer((request, response) => {
    void respondWithAsset(assetsRootPath, request, response);
  });

  await listen(server, options.port ?? 0);
  const port = resolveBoundPort(server.address());

  return {
    url: `http://127.0.0.1:${port}/`,
    port,
    close: () => closeServer(server),
  };
}
