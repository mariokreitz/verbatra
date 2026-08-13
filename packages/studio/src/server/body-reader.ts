import type { IncomingMessage } from "node:http";

export const BODY_CAP_BYTES = 1024 * 1024;

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
