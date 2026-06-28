/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { getRuntimeVersionState } from '@/lib/runtime-version'
import { cn } from '@/lib/utils'

const FEEDBACK_URL = 'https://github.com/BaizorAI/new-api/issues'

type GeneralErrorProps = React.HTMLAttributes<HTMLDivElement> & {
  minimal?: boolean
  error?: unknown
}

function getHttpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const response = (error as Record<string, unknown>).response
  if (typeof response !== 'object' || response === null) return undefined
  const status = (response as Record<string, unknown>).status
  return typeof status === 'number' ? status : undefined
}

function getErrorText(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return ''
  }
}

function isChunkLoadError(error: unknown): boolean {
  const text = getErrorText(error)
  return (
    text.includes('ChunkLoadError') ||
    text.includes('Loading chunk') ||
    text.includes('failed to fetch dynamically imported module')
  )
}

function reloadCurrentPage(): void {
  window.location.reload()
}

export function GeneralError({
  className,
  minimal = false,
  error,
}: GeneralErrorProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { history } = useRouter()
  const status = getHttpStatus(error)
  const chunkLoadError = isChunkLoadError(error)
  const isRateLimited = status === 429
  const title = isRateLimited
    ? t('Too many requests')
    : `${t('Oops! Something went wrong')} ${`:')`}`
  const description = isRateLimited
    ? t('Please wait a moment before trying again.')
    : t('Please try again later.')

  useEffect(() => {
    if (!chunkLoadError) return

    let cancelled = false

    async function recoverFromChunkLoadError(): Promise<void> {
      const pathKey = `${window.location.pathname}${window.location.search}`

      try {
        const versionState = await getRuntimeVersionState()
        const reloadKey = `chunk-load-reload:${pathKey}:${versionState.currentVersion}:${versionState.serverVersion ?? 'unknown'}`

        if (cancelled || sessionStorage.getItem(reloadKey) === '1') return
        if (!versionState.changed) return

        sessionStorage.setItem(reloadKey, '1')
        window.location.reload()
      } catch {
        const fallbackKey = `chunk-load-reload:${pathKey}:fallback`
        if (cancelled || sessionStorage.getItem(fallbackKey) === '1') return

        sessionStorage.setItem(fallbackKey, '1')
        window.location.reload()
      }
    }

    void recoverFromChunkLoadError()

    return () => {
      cancelled = true
    }
  }, [chunkLoadError])

  return (
    <div className={cn('h-svh w-full', className)}>
      <div className='m-auto flex h-full w-full flex-col items-center justify-center gap-2'>
        {!minimal && (
          <h1 className='text-[7rem] leading-tight font-bold'>
            {status ?? 500}
          </h1>
        )}
        <span className='font-medium'>{title}</span>
        <p className='text-muted-foreground text-center'>
          {t('We apologize for the inconvenience.')} <br /> {description}
        </p>
        {!minimal && (
          <p className='text-muted-foreground text-center text-sm'>
            {t('If this keeps happening, please report it on GitHub Issues.')}
          </p>
        )}
        {!minimal && (
          <div className='mt-6 flex flex-wrap justify-center gap-4'>
            <Button variant='outline' onClick={() => history.go(-1)}>
              {t('Go Back')}
            </Button>
            <Button
              variant='outline'
              render={
                <a
                  href={FEEDBACK_URL}
                  target='_blank'
                  rel='noopener noreferrer'
                />
              }
            >
              {t('Report an issue')}
            </Button>
            {chunkLoadError && (
              <Button variant='outline' onClick={reloadCurrentPage}>
                {t('Retry')}
              </Button>
            )}
            <Button onClick={() => navigate({ to: '/' })}>
              {t('Back to Home')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
