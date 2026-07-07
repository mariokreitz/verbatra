import type { IncomingMessage } from "node:http";

/** The request body cap: 1 MiB. The bundled SPA is the only client, so this costs it nothing. */
export const BODY_CAP_BYTES = 1024 * 1024;

/** Thrown when a request body exceeds {@link BODY_CAP_BYTES}, whether declared or streamed. */
export class PayloadTooLargeError extends Error {
  constructor() {
    super("request body exceeds the size cap");
    this.name = "PayloadTooLargeError";
  }
}

function declaredLengthExceedsCap(request: IncomingMessage, capBytes: number): boolean {
  const header = request.headers["content-length"];
  if (header === undefined) {
    return false;
  }
  const declared = Number(header);
  return Number.isFinite(declared) && declared > capBytes;
}

/**
 * Reads a request body up to `capBytes`. A declared Content-Length over the cap rejects
 * immediately without buffering a single byte; the socket is drained (not destroyed) so the
 * client's upload completes normally and it still receives the 413 response. Otherwise bytes are
 * counted as they stream in and the connection is destroyed the instant the cap is crossed, since
 * without a Content-Length header there is no bound on how much more data might follow.
 */
export function readBodyWithCap(request: IncomingMessage, capBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (declaredLengthExceedsCap(request, capBytes)) {
      request.resume();
      reject(new PayloadTooLargeError());
      return;
    }

    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;

    const settleReject = (error: Error): void => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };

    request.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > capBytes) {
        settled = true;
        reject(new PayloadTooLargeError());
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      settled = true;
      resolve(Buffer.concat(chunks));
    });
    request.on("error", settleReject);
    // Fires whether the connection ended normally or the client vanished mid-upload; without this,
    // an aborted upload (no more data, no "end", no stream "error") would leave the promise pending
    // forever instead of failing the request.
    request.on("close", () =>
      settleReject(new Error("request closed before the body was fully received")),
    );
  });
}
