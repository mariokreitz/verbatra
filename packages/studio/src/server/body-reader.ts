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
 * client's upload completes normally and it can still receive an error response. Without a
 * trustworthy Content-Length, bytes are counted as they stream in and the connection is destroyed
 * the instant the cap is crossed. A connection that closes before the body fully arrives rejects
 * with a plain error instead of leaving the promise pending.
 *
 * @param request - The incoming request whose body is read.
 * @param capBytes - The maximum number of body bytes accepted.
 * @throws PayloadTooLargeError (as a rejection) when the body exceeds the cap.
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
    request.on("close", () =>
      settleReject(new Error("request closed before the body was fully received")),
    );
  });
}
