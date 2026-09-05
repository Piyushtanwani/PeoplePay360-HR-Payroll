import { useMutation, useQueryClient, type QueryKey, type UseMutationResult } from '@tanstack/react-query'
import { ApiError } from './client'
import { useToast } from '@/components/ui/Toast'

export interface ApiMutationOptions<TData, TVars> {
  mutationFn: (vars: TVars) => Promise<TData>
  /** Query keys to refresh once the write succeeds. Prefix matching, so a resource root covers its lists. */
  invalidate?: QueryKey[]
  /** Confirmation copy. A function receives the response, so it can name what happened. */
  success?: string | ((data: TData, vars: TVars) => string | null)
  /** Heading on the failure toast, phrased as what did not happen. */
  errorTitle: string
  onSuccess?: (data: TData, vars: TVars) => void
  /** Return true to suppress the default toast, for a failure the screen shows inline instead. */
  onError?: (error: unknown, vars: TVars) => boolean | void
}

/**
 * A mutation that always reports itself.
 *
 * Twelve mutations in this app had no error handler at all, so a rejected request left the button
 * spinning and the panel open with no explanation. Going through here means every write either
 * confirms or explains, and carries the request id an administrator can search the audit log for.
 */
export function useApiMutation<TData = unknown, TVars = void>(
  options: ApiMutationOptions<TData, TVars>,
): UseMutationResult<TData, unknown, TVars> {
  const toast = useToast()
  const queryClient = useQueryClient()

  return useMutation<TData, unknown, TVars>({
    mutationFn: options.mutationFn,
    onSuccess: (data, vars) => {
      for (const key of options.invalidate ?? []) {
        queryClient.invalidateQueries({ queryKey: key })
      }
      const message = typeof options.success === 'function' ? options.success(data, vars) : options.success
      if (message) toast.push({ tone: 'success', title: message })
      options.onSuccess?.(data, vars)
    },
    onError: (error, vars) => {
      if (options.onError?.(error, vars) === true) return
      const isApi = error instanceof ApiError
      toast.push({
        tone: 'error',
        title: options.errorTitle,
        detail: isApi ? error.detail : 'Something went wrong. Please try again.',
        requestId: isApi ? error.requestId : undefined,
      })
    },
  })
}

/** The message to show beside a field or in a callout, for failures a screen handles itself. */
export function errorText(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof ApiError) return error.detail
  if (error instanceof Error) return error.message
  return fallback
}
