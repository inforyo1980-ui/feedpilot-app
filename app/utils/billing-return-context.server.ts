export type BillingReturnContext = {
  shop: string;
  returnTo: string;
  billingSuccessIntent: true;
  host?: string;
  createdAt: number;
};

const BILLING_RETURN_CONTEXT_COOKIE = "feedpilot_billing_return_context";
const BILLING_RETURN_CONTEXT_TTL_SECONDS = 10 * 60;
const BILLING_RETURN_CONTEXT_TTL_MS = BILLING_RETURN_CONTEXT_TTL_SECONDS * 1000;

function encodeContext(context: BillingReturnContext) {
  return Buffer.from(JSON.stringify(context), "utf8").toString("base64url");
}

function decodeContext(value: string): BillingReturnContext | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));

    if (
      typeof parsed?.shop !== "string" ||
      typeof parsed?.returnTo !== "string" ||
      parsed?.billingSuccessIntent !== true ||
      typeof parsed?.createdAt !== "number"
    ) {
      return null;
    }

    if (parsed.host !== undefined && typeof parsed.host !== "string") {
      return null;
    }

    if (Date.now() - parsed.createdAt > BILLING_RETURN_CONTEXT_TTL_MS) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function getCookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;

  for (const cookie of cookieHeader.split(";")) {
    const [cookieName, ...valueParts] = cookie.trim().split("=");
    if (cookieName === name) {
      return valueParts.join("=");
    }
  }

  return null;
}

export function buildBillingReturnContextCookie(
  context: Omit<BillingReturnContext, "createdAt">,
) {
  const value = encodeContext({ ...context, createdAt: Date.now() });

  return [
    `${BILLING_RETURN_CONTEXT_COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=None",
    "Secure",
    `Max-Age=${BILLING_RETURN_CONTEXT_TTL_SECONDS}`,
  ].join("; ");
}

export function getBillingReturnContext(request: Request) {
  const value = getCookieValue(request, BILLING_RETURN_CONTEXT_COOKIE);
  return value ? decodeContext(value) : null;
}

export function clearBillingReturnContextCookie() {
  return [
    `${BILLING_RETURN_CONTEXT_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=None",
    "Secure",
    "Max-Age=0",
  ].join("; ");
}
