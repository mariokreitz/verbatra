export function isJsonRequestContentType(header: string | undefined): boolean {
  if (header === undefined) {
    return false;
  }
  return header.trim().toLowerCase() === "application/json";
}
