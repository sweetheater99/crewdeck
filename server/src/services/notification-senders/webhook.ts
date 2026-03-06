import { createHmac } from "crypto";

export async function sendWebhook(
  config: { url: string; secret?: string },
  payload: object,
): Promise<void> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.secret) {
    const sig = createHmac("sha256", config.secret)
      .update(body)
      .digest("hex");
    headers["X-Crewdeck-Signature"] = sig;
  }

  const res = await fetch(config.url, { method: "POST", headers, body });
  if (!res.ok) {
    throw new Error(`Webhook error: ${res.status}`);
  }
}
