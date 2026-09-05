import * as React from 'react'
import { ApiError, request } from '@/api/client'
import { useToast } from '@/components/ui/Toast'

/** Hands a blob to the browser as a file, then releases the object URL. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/**
 * Downloads an authenticated file.
 *
 * The hand-rolled versions of this used a bare fetch with no status check, so a permission denial was
 * saved to disk as a spreadsheet containing an error message. This raises instead, and refuses to save
 * anything that came back as JSON.
 */
export async function downloadFile(
  path: string,
  fallbackName: string,
  query?: Record<string, string | number | boolean | null | undefined>,
) {
  const response = await request<Response>(path, { query, raw: true })
  const type = response.headers.get('Content-Type') ?? ''
  if (type.includes('json')) {
    const problem = await response.json().catch(() => ({}))
    throw new ApiError({ status: response.status, ...problem })
  }
  saveBlob(await response.blob(), filenameFrom(response) ?? fallbackName)
}

/** Prefers the server's own filename, which carries the period and the record id. */
function filenameFrom(response: Response): string | null {
  const header = response.headers.get('Content-Disposition')
  const match = header?.match(/filename="?([^"]+)"?/)
  return match ? match[1] : null
}

/** Download with the pending state and the error toast already wired. */
export function useDownload() {
  const toast = useToast()
  const [pending, setPending] = React.useState(false)

  const download = React.useCallback(
    async (path: string, fallbackName: string, query?: Parameters<typeof downloadFile>[2]) => {
      setPending(true)
      try {
        await downloadFile(path, fallbackName, query)
      } catch (error) {
        const detail = error instanceof ApiError ? error.detail : 'The download could not be completed.'
        toast.push({
          tone: 'error',
          title: 'Download failed',
          detail,
          requestId: error instanceof ApiError ? error.requestId : undefined,
        })
      } finally {
        setPending(false)
      }
    },
    [toast],
  )

  return { download, pending }
}
