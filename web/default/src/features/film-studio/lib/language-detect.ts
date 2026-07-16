/**
 * Detect the dominant language of a text based on CJK character ratio.
 * Returns 'zh' if CJK characters make up >40% of meaningful characters,
 * otherwise returns 'en'.
 */
export function detectLanguage(text: string): 'zh' | 'en' {
  if (!text) return 'en'

  let cjk = 0
  let alpha = 0

  for (const ch of text) {
    const code = ch.codePointAt(0)!
    // CJK Unified Ideographs + Extensions + Compatibility
    if (
      (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
      (code >= 0x3400 && code <= 0x4dbf) || // CJK Extension A
      (code >= 0x20000 && code <= 0x2a6df) || // CJK Extension B
      (code >= 0xf900 && code <= 0xfaff) // CJK Compatibility Ideographs
    ) {
      cjk++
    } else if (
      (code >= 0x61 && code <= 0x7a) || // a-z
      (code >= 0x41 && code <= 0x5a) // A-Z
    ) {
      alpha++
    }
  }

  const total = cjk + alpha
  if (total === 0) return 'en'

  return cjk / total > 0.4 ? 'zh' : 'en'
}

/** Get a language instruction string for use in prompts. */
export function getLanguageInstruction(text: string): string {
  const lang = detectLanguage(text)
  if (lang === 'zh') {
    return '\n**重要：请用中文输出全部内容。使用中文场景标题格式（如"内景. 咖啡馆 - 日"），避免使用 INT./EXT. 等英文格式。**'
  }
  return '\n**Important: Output all content in English.**'
}
