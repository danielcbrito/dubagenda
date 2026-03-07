export interface ChatAttachment {
  name?: string;
  url: string;
  mimeType?: string;
}

const ATTACHMENTS_JSON_REGEX = /\[ATTACHMENTS_JSON\]([\s\S]*?)\[\/ATTACHMENTS_JSON\]/;
const LEGACY_ATTACHMENTS_REGEX = /\[(\d+)\s+arquivo\(s\)\s+anexado\(s\):([\s\S]*?)\]/i;
const IMAGE_URL_REGEX = /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i;

function toAttachment(input: unknown): ChatAttachment | null {
  if (!input || typeof input !== "object") return null;

  const maybe = input as Partial<ChatAttachment>;
  if (!maybe.url || typeof maybe.url !== "string") return null;

  return {
    url: maybe.url,
    name: typeof maybe.name === "string" ? maybe.name : undefined,
    mimeType: typeof maybe.mimeType === "string" ? maybe.mimeType : undefined,
  };
}

function dedupeAttachments(attachments: ChatAttachment[]): ChatAttachment[] {
  const seen = new Set<string>();
  return attachments.filter((attachment) => {
    if (seen.has(attachment.url)) return false;
    seen.add(attachment.url);
    return true;
  });
}

function parseLegacyAttachments(block: string): ChatAttachment[] {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed: ChatAttachment[] = [];

  for (const line of lines) {
    const match = line.match(/^-\s*(.*?):\s*(https?:\/\/\S+)$/i);
    if (match) {
      parsed.push({ name: match[1].trim(), url: match[2].trim() });
      continue;
    }

    const urlMatch = line.match(/(https?:\/\/\S+)/i);
    if (urlMatch) {
      parsed.push({ url: urlMatch[1].trim() });
    }
  }

  return parsed;
}

export function composeMessageContent(text: string, attachments: ChatAttachment[]): string {
  const cleanText = text.trim();
  if (attachments.length === 0) return cleanText;

  const serialized = encodeURIComponent(JSON.stringify(attachments));
  const prefix = cleanText ? `${cleanText}\n\n` : "";

  return `${prefix}[ATTACHMENTS_JSON]${serialized}[/ATTACHMENTS_JSON]`;
}

export function parseMessageContent(content: string): { text: string; attachments: ChatAttachment[] } {
  let text = content || "";
  let attachments: ChatAttachment[] = [];

  const jsonMatch = text.match(ATTACHMENTS_JSON_REGEX);
  if (jsonMatch) {
    try {
      const decoded = decodeURIComponent(jsonMatch[1]);
      const parsed = JSON.parse(decoded);
      if (Array.isArray(parsed)) {
        attachments.push(...parsed.map(toAttachment).filter((value): value is ChatAttachment => Boolean(value)));
      }
    } catch {
      // Ignore malformed attachment payloads
    }

    text = text.replace(jsonMatch[0], "").trim();
  }

  const legacyMatch = text.match(LEGACY_ATTACHMENTS_REGEX);
  if (legacyMatch) {
    attachments.push(...parseLegacyAttachments(legacyMatch[2] || ""));
    text = text.replace(legacyMatch[0], "").trim();
  }

  return {
    text,
    attachments: dedupeAttachments(attachments),
  };
}

export function isImageAttachment(attachment: ChatAttachment): boolean {
  if (attachment.mimeType?.startsWith("image/")) return true;
  return IMAGE_URL_REGEX.test(attachment.url);
}
