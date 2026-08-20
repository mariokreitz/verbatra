import { HONEYPOT_FIELD } from "./honeypot-field";
import type { ContactPayload } from "./schema";

export function isHoneypotFilled(payload: ContactPayload): boolean {
  return payload[HONEYPOT_FIELD].trim().length > 0;
}
