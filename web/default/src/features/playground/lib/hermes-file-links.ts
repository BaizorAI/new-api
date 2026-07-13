const HERMES_DATA_PATH_PATTERN =
  /(MEDIA:)?(\/(?:opt\/data|hermes-data)\/[^\s<>)\]}"]+)/g

const HERMES_FILE_MARKDOWN_LINK_PATTERN =
  /\[([^\]]+)\]\((\/pg\/hermes\/files\/[^\s)]+)\)/g

const TRAILING_PUNCTUATION_PATTERN =
  /[.,;:!?\uFF0C\u3002\uFF1B\uFF1A\uFF01\uFF1F`]+$/

export interface HermesFileArtifact {
  href: string
  label: string
  filename: string
}

export function renderHermesDataPathsAsLinks(content: string): string {
  if (!content.includes('/opt/data/') && !content.includes('/hermes-data/')) {
    return content
  }

  return content.replace(
    HERMES_DATA_PATH_PATTERN,
    (match, _mediaPrefix: string | undefined, rawPath: string) => {
      const trailing = rawPath.match(TRAILING_PUNCTUATION_PATTERN)?.[0] ?? ''
      const cleanPath = trailing ? rawPath.slice(0, -trailing.length) : rawPath
      const relativePath = cleanPath.replace(
        /^\/(?:opt\/data|hermes-data)\//,
        ''
      )
      if (!relativePath) return match

      const href = `/pg/hermes/files/${relativePath
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/')}`
      const filename = relativePath.split('/').filter(Boolean).at(-1)
      const label = filename || relativePath

      return `[${label}](${href})${trailing}`
    }
  )
}

export function extractHermesFileArtifacts(
  content: string
): HermesFileArtifact[] {
  const linkedContent = renderHermesDataPathsAsLinks(content)
  const artifacts = new Map<string, HermesFileArtifact>()

  for (const match of linkedContent.matchAll(
    HERMES_FILE_MARKDOWN_LINK_PATTERN
  )) {
    const label = match[1]?.trim() || ''
    const href = match[2]?.trim() || ''
    if (!href) continue

    const filename = decodeHermesFilename(href) || label || href
    artifacts.set(href, {
      href,
      label: label || filename,
      filename,
    })
  }

  return [...artifacts.values()]
}

function decodeHermesFilename(href: string): string {
  const rawFilename = href.split('/').filter(Boolean).at(-1) ?? ''
  if (!rawFilename) return ''

  try {
    return decodeURIComponent(rawFilename)
  } catch {
    return rawFilename
  }
}
