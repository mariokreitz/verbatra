import { checkArcjet } from "./arcjet";
import { sendContactEmail } from "./email";
import { isHoneypotFilled } from "./honeypot";
import { serverErrorResponse, successResponse, validationErrorResponse } from "./respond";
import { parseContactRequest } from "./schema";

export async function POST(request: Request): Promise<Response> {
  const blocked = await checkArcjet(request);
  if (blocked) return blocked;

  const parsed = await parseContactRequest(request);
  if (!parsed.success) return validationErrorResponse(parsed.errors);

  if (isHoneypotFilled(parsed.data)) return successResponse();

  const sent = await sendContactEmail(parsed.data);
  if (!sent.ok) return serverErrorResponse();

  return successResponse();
}
