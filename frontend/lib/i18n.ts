import texts from "@/texts.json"

export function t(key: string, params?: Record<string, string>): string {
  const value = texts[key] ?? key
  if (!params) return value
  return value.replace(/\{(\w+)\}/g, (_, name) => params[name] ?? `{${name}}`)
}
