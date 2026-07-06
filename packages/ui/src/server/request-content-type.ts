// Inbound direction: whether an incoming request's own Content-Type header on POST /rpc is
// acceptable. For the outbound direction, choosing the Content-Type this server sets on a served
// static asset, see content-type.ts.

/** Checks a request Content-Type for an exact `application/json` match after trim and lowercase; parameterized variants such as a charset are rejected. */
export function isJsonRequestContentType(header: string | undefined): boolean {
  if (header === undefined) {
    return false;
  }
  return header.trim().toLowerCase() === "application/json";
}
