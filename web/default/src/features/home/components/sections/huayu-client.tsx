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
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  Globe,
  LogIn,
  Monitor,
  Package,
  Terminal,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { Button } from '@/components/ui/button'

const tuiPreview = `┌── 华宇 huayu | codex [Tab切换] | huayu-v2 | ●连接中 ──────────┐
│                                                                │
├──────────────────────────────┬─────────────────────────────────┤
│  主工作区 (左 ~70%)            │  帮助与参考 (右 ~30%)            │
│  执行日志、AI 输出、文件事件   │  快捷键速查 / 最近命令           │
├──────────────────────────────┴─────────────────────────────────┤
│  输入框: /help                                                  │
│  [Enter]发送 [Shift+Enter]换行 [Tab]切换工具 [Alt+Q]退出        │
└────────────────────────────────────────────────────────────────┘`

export function HuayuClient() {
  const { t } = useTranslation()

  const highlights = [
    {
      icon: <Monitor className='size-4 text-emerald-500' />,
      text: 'Unified TUI',
    },
    {
      icon: <LogIn className='size-4 text-emerald-500' />,
      text: 'One-click login',
    },
    {
      icon: <Package className='size-4 text-emerald-500' />,
      text: 'Zero-dependency install',
    },
    {
      icon: <Globe className='size-4 text-emerald-500' />,
      text: 'Cross-platform',
    },
  ]

  return (
    <section className='relative z-10 px-6 py-24 md:py-32'>
      <div className='mx-auto max-w-6xl'>
        <div className='border-border/40 bg-muted/20 rounded-2xl border p-8 md:p-12 lg:p-14'>
          <div className='relative grid gap-10 lg:grid-cols-2 lg:gap-14'>
            <AnimateInView className='flex flex-col items-start'>
              <div className='mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400'>
                <Terminal className='size-3.5' />
                <span>{t('AI client')}</span>
              </div>

              <h2 className='text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight font-bold tracking-tight'>
                {t('Huayu AI Client')}
              </h2>
              <p className='text-muted-foreground mt-4 max-w-xl leading-relaxed'>
                {t(
                  'Huayu is an AI client for baizor.com. A Rust TUI terminal app that integrates Codex and Claude Code into a unified interactive interface.'
                )}
              </p>

              <ul className='mt-6 grid gap-3 sm:grid-cols-2'>
                {highlights.map((item) => (
                  <li
                    key={item.text}
                    className='flex items-center gap-2 text-sm'
                  >
                    {item.icon}
                    <span>{t(item.text)}</span>
                  </li>
                ))}
              </ul>

              <Button
                className='group mt-8 rounded-lg'
                render={<Link to='/huayu' />}
              >
                {t('Learn more')}
                <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
              </Button>
            </AnimateInView>

            <AnimateInView>
              <div className='overflow-x-auto rounded-lg border bg-background p-4'>
                <pre className='text-muted-foreground text-xs leading-relaxed md:text-sm'>
                  {tuiPreview}
                </pre>
              </div>
            </AnimateInView>
          </div>
        </div>
      </div>
    </section>
  )
}
