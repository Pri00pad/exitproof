export const MIN_PASSWORD_LENGTH = 8;
export const MAX_CUSTOM_ITEMS = 10;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isEmail(value: string): boolean {
  return value.length <= 320 && EMAIL_RE.test(value);
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function formText(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}
