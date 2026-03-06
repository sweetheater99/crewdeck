export async function sendDiscord(
  config: { webhookUrl: string },
  text: string,
  options?: { color?: number },
): Promise<void> {
  const res = await fetch(config.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          description: text,
          color: options?.color ?? 0x5865f2,
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Discord webhook error: ${res.status}`);
  }
}
