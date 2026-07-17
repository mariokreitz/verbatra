/**
 * Checks an incoming request's Content-Type header for an exact `application/json` match after
 * trim and lowercase. Parameterized variants such as a charset are rejected, as is a missing
 * header. For the outbound direction (the Content-Type this server sets on a served static
 * asset) see content-type.ts.
 */
export function isJsonRequestContentType(header: string | undefined): boolean {
  if (header === undefined) {
    return false;
  }
  return header.trim().toLowerCase() === "application/json";
}
