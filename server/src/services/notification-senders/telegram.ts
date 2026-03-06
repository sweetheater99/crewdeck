export async function sendTelegram(
  config: { botToken: string; chatId: string },
  text: string,
  options?: { replyMarkup?: object },
): Promise<void> {
  const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
  const body: Record<string, unknown> = {
    chat_id: config.chatId,
    text,
    parse_mode: "HTML", // IMPORTANT: always HTML, never Markdown
  };
  if (options?.replyMarkup) {
    body.reply_markup = JSON.stringify(options.replyMarkup);
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram API error: ${res.status} ${err}`);
  }
}
