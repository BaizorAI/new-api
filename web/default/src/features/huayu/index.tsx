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
  Command,
  Download,
  Globe,
  Keyboard,
  LogIn,
  Monitor,
  Package,
  Rocket,
  Terminal,
  Wrench,
  Zap,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import {
  CodeBlock,
  CodeBlockCopyButton,
} from '@/components/ai-elements/code-block'
import { PublicLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'

const features = [
  {
    icon: <Monitor className='size-5 text-blue-500' />,
    title: 'Unified TUI',
    desc: 'Codex and Claude Code dual engines, switch with Tab key.',
  },
  {
    icon: <LogIn className='size-5 text-emerald-500' />,
    title: 'One-click login',
    desc: 'Browser OAuth login to baizor.com, auto-configure all API keys.',
  },
  {
    icon: <Package className='size-5 text-violet-500' />,
    title: 'Zero-dependency install',
    desc: 'No Node.js or npm required, bundled locked-version tool binaries.',
  },
  {
    icon: <Command className='size-5 text-amber-500' />,
    title: 'Slash commands',
    desc: '/switch, /model, /update, /status and more built-in commands.',
  },
  {
    icon: <Wrench className='size-5 text-cyan-500' />,
    title: 'Smart build system',
    desc: 'Source fingerprint detection, automatic version bump.',
  },
  {
    icon: <Globe className='size-5 text-teal-500' />,
    title: 'Cross-platform',
    desc: 'Windows x64 / Linux x64+aarch64 / macOS x64+aarch64.',
  },
] as const

const painPoints = [
  {
    problem: 'Codex / Claude require separate installs and Node.js',
    solution: 'Bundled locked-version binaries, zero external dependencies',
  },
  {
    problem: 'Different interaction patterns for each tool',
    solution: 'Unified TUI with consistent keybindings',
  },
  {
    problem: 'Tedious API key configuration',
    solution: 'Browser OAuth one-click login, auto-generates all config files',
  },
  {
    problem: 'High installation barrier',
    solution: 'One-line command install, no admin privileges required',
  },
] as const

const shortcuts = [
  { key: 'Enter', action: 'Send message / execute command' },
  { key: 'Tab', action: 'Switch between Codex and Claude' },
  { key: 'Shift+Enter', action: 'New line in input' },
  { key: 'Esc', action: 'Cancel current task / close dialog' },
  { key: 'Alt+Q', action: 'Quit program' },
  { key: '↑ / ↓', action: 'Navigate input history' },
  { key: 'Page Up / Page Down', action: 'Scroll main panel' },
] as const

const steps = [
  {
    num: '1',
    title: 'Login',
    desc: 'Run huayu login to authenticate via browser OAuth.',
    cmd: 'huayu login',
  },
  {
    num: '2',
    title: 'Check status',
    desc: 'Run huayu status to verify configuration and tools.',
    cmd: 'huayu status',
  },
  {
    num: '3',
    title: 'Launch workstation',
    desc: 'Run huayu to start the TUI workstation.',
    cmd: 'huayu',
  },
] as const

const tuiPreview = `┌── 华宇 huayu | codex [Tab切换] | huayu-v2 | ●连接中 ──────────┐
│                                                                │
├──────────────────────────────┬─────────────────────────────────┤
│  主工作区 (左 ~70%)            │  帮助与参考 (右 ~30%)            │
│  执行日志、AI 输出、文件事件   │  快捷键速查 / 最近命令           │
├──────────────────────────────┴─────────────────────────────────┤
│  输入框: /help                                                  │
│  [Enter]发送 [Shift+Enter]换行 [Tab]切换工具 [Alt+Q]退出        │
└────────────────────────────────────────────────────────────────┘`

function Huayu() {
  const { t } = useTranslation()

  return (
    <PublicLayout>
      <div className='mx-auto max-w-5xl space-y-16 px-4 py-12 md:py-20'>
        {/* Hero */}
        <AnimateInView className='text-center'>
          <div className='mb-6 flex justify-center'>
            <div className='flex size-20 items-center justify-center rounded-3xl border border-emerald-500/15 bg-emerald-500/5 shadow-sm'>
              <Terminal className='size-10 text-emerald-500' />
            </div>
          </div>
          <h1 className='text-4xl font-bold tracking-tight md:text-5xl'>
            {t('Huayu AI Workstation')}
          </h1>
          <p className='text-muted-foreground mx-auto mt-4 max-w-2xl text-lg leading-relaxed'>
            {t(
              'Huayu is an AI coding workstation for baizor.com. A Rust TUI terminal app that integrates Codex and Claude Code into a unified interactive interface.'
            )}
          </p>
          <div className='mt-8 flex flex-wrap items-center justify-center gap-3'>
            <Button
              className='group rounded-lg'
              render={
                <a
                  href='https://github.com/BaizorAI/huayu'
                  target='_blank'
                  rel='noopener noreferrer'
                />
              }
            >
              {t('View on GitHub')}
              <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
            </Button>
            <Button
              variant='outline'
              className='border-border/50 hover:border-border hover:bg-muted/50 rounded-lg'
              render={<Link to='/' />}
            >
              {t('Back to home')}
            </Button>
          </div>
        </AnimateInView>

        {/* Install section */}
        <AnimateInView delay={100}>
          <div className='border-border/40 bg-muted/20 rounded-2xl border p-8 md:p-10'>
            <div className='mb-6 flex items-center gap-3'>
              <div className='flex size-12 items-center justify-center rounded-2xl border border-blue-500/15 bg-blue-500/5'>
                <Download className='size-6 text-blue-500' />
              </div>
              <div>
                <h2 className='text-xl font-bold'>
                  {t('One-line install')}
                </h2>
                <p className='text-muted-foreground text-sm'>
                  {t('No admin privileges required')}
                </p>
              </div>
            </div>

            <div className='space-y-6'>
              {/* Windows */}
              <div>
                <div className='mb-2 flex items-center gap-2'>
                  <span className='rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400'>
                    Windows
                  </span>
                  <span className='text-muted-foreground text-xs'>
                    PowerShell
                  </span>
                </div>
                <CodeBlock code='irm https://baizor.com/install/huayu.ps1 | iex' language='shell'>
                  <CodeBlockCopyButton />
                </CodeBlock>
              </div>

              {/* macOS / Linux */}
              <div>
                <div className='mb-2 flex items-center gap-2'>
                  <span className='rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400'>
                    macOS / Linux
                  </span>
                  <span className='text-muted-foreground text-xs'>
                    Bash
                  </span>
                </div>
                <CodeBlock code='curl -fsSL https://baizor.com/install/huayu.sh | bash' language='bash'>
                  <CodeBlockCopyButton />
                </CodeBlock>
              </div>

              {/* Verify */}
              <div>
                <div className='mb-2 flex items-center gap-2'>
                  <span className='rounded-md bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-400'>
                    {t('Verify installation')}
                  </span>
                </div>
                <CodeBlock code='huayu status' language='bash'>
                  <CodeBlockCopyButton />
                </CodeBlock>
              </div>
            </div>

            <div className='text-muted-foreground mt-6 space-y-1 text-sm'>
              <p>
                {t(
                  'The Windows installer downloads the latest release, extracts to ~/.huayu/, and adds bin/ to your User PATH. No admin privileges needed.'
                )}
              </p>
              <p>
                {t(
                  'For macOS / Linux, you can also download the tar.gz from GitHub Releases manually.'
                )}
              </p>
            </div>
          </div>
        </AnimateInView>

        {/* Quick start steps */}
        <AnimateInView delay={100}>
          <div className='mb-10 text-center'>
            <h2 className='text-2xl font-bold tracking-tight md:text-3xl'>
              {t('Quick start')}
            </h2>
            <p className='text-muted-foreground mt-2'>
              {t('Three commands to get started')}
            </p>
          </div>
          <div className='grid gap-5 md:grid-cols-3'>
            {steps.map((step, index) => (
              <AnimateInView
                key={step.num}
                delay={index * 80}
                animation='fade-up'
              >
                <div className='border-border/40 bg-muted/20 group hover:bg-muted/30 flex h-full flex-col rounded-xl border p-6 transition-colors duration-300'>
                  <div className='mb-4 flex items-center gap-3'>
                    <div className='bg-primary/10 text-primary flex size-8 items-center justify-center rounded-full text-sm font-bold'>
                      {step.num}
                    </div>
                    <h3 className='font-semibold'>{t(step.title)}</h3>
                  </div>
                  <p className='text-muted-foreground mb-4 flex-1 text-sm leading-relaxed'>
                    {t(step.desc)}
                  </p>
                  <CodeBlock code={step.cmd} language='bash'>
                    <CodeBlockCopyButton />
                  </CodeBlock>
                </div>
              </AnimateInView>
            ))}
          </div>
        </AnimateInView>

        {/* Pain points → solutions */}
        <AnimateInView delay={100}>
          <div className='border-border/40 bg-muted/20 rounded-2xl border p-8 md:p-10'>
            <div className='mb-6 flex items-center gap-3'>
              <div className='flex size-12 items-center justify-center rounded-2xl border border-amber-500/15 bg-amber-500/5'>
                <Zap className='size-6 text-amber-500' />
              </div>
              <h2 className='text-xl font-bold'>
                {t('Problems solved')}
              </h2>
            </div>
            <div className='grid gap-4 md:grid-cols-2'>
              {painPoints.map((item, index) => (
                <div
                  key={index}
                  className='border-border/30 bg-background/50 rounded-lg border p-4'
                >
                  <p className='text-muted-foreground text-sm line-through decoration-red-400/50'>
                    {t(item.problem)}
                  </p>
                  <p className='mt-2 text-sm font-medium text-emerald-600 dark:text-emerald-400'>
                    {'✓'} {t(item.solution)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </AnimateInView>

        {/* Features grid */}
        <section>
          <AnimateInView className='mb-10 text-center'>
            <h2 className='text-2xl font-bold tracking-tight md:text-3xl'>
              {t('Features')}
            </h2>
            <p className='text-muted-foreground mt-2'>
              {t('Everything you need for AI-powered coding in the terminal')}
            </p>
          </AnimateInView>
          <div className='grid gap-5 md:grid-cols-2 lg:grid-cols-3'>
            {features.map((feature, index) => (
              <AnimateInView
                key={feature.title}
                delay={index * 80}
                animation='fade-up'
              >
                <div className='border-border/40 bg-muted/20 group hover:bg-muted/30 h-full rounded-xl border p-6 transition-colors duration-300'>
                  <div className='mb-4 flex items-center gap-3'>
                    <div className='border-border/40 bg-background flex size-10 items-center justify-center rounded-xl border shadow-sm'>
                      {feature.icon}
                    </div>
                    <h3 className='font-semibold'>{t(feature.title)}</h3>
                  </div>
                  <p className='text-muted-foreground text-sm leading-relaxed'>
                    {t(feature.desc)}
                  </p>
                </div>
              </AnimateInView>
            ))}
          </div>
        </section>

        {/* TUI preview */}
        <AnimateInView delay={100}>
          <div className='border-border/40 bg-muted/20 rounded-2xl border p-8 md:p-10'>
            <div className='mb-6 flex items-center gap-3'>
              <div className='flex size-12 items-center justify-center rounded-2xl border border-cyan-500/15 bg-cyan-500/5'>
                <Rocket className='size-6 text-cyan-500' />
              </div>
              <div>
                <h2 className='text-xl font-bold'>
                  {t('Interface preview')}
                </h2>
                <p className='text-muted-foreground text-sm'>
                  {t('Split-panel TUI with main workspace and help sidebar')}
                </p>
              </div>
            </div>
            <div className='overflow-x-auto'>
              <pre className='bg-background border-border/40 overflow-x-auto rounded-lg border p-4 font-mono text-xs leading-relaxed md:text-sm'>
                {tuiPreview}
              </pre>
            </div>
          </div>
        </AnimateInView>

        {/* Keyboard shortcuts */}
        <AnimateInView delay={100}>
          <div className='border-border/40 bg-muted/20 rounded-2xl border p-8 md:p-10'>
            <div className='mb-6 flex items-center gap-3'>
              <div className='flex size-12 items-center justify-center rounded-2xl border border-violet-500/15 bg-violet-500/5'>
                <Keyboard className='size-6 text-violet-500' />
              </div>
              <h2 className='text-xl font-bold'>
                {t('Keyboard shortcuts')}
              </h2>
            </div>
            <div className='grid gap-2 md:grid-cols-2'>
              {shortcuts.map((shortcut) => (
                <div
                  key={shortcut.key}
                  className='border-border/30 bg-background/50 flex items-center justify-between rounded-lg border px-4 py-3'
                >
                  <kbd className='bg-muted border-border/50 rounded-md border px-2 py-0.5 font-mono text-xs font-medium'>
                    {shortcut.key}
                  </kbd>
                  <span className='text-muted-foreground text-sm'>
                    {t(shortcut.action)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </AnimateInView>

        {/* Slash commands quick reference */}
        <AnimateInView delay={100}>
          <div className='border-border/40 bg-muted/20 rounded-2xl border p-8 md:p-10'>
            <div className='mb-6 flex items-center gap-3'>
              <div className='flex size-12 items-center justify-center rounded-2xl border border-amber-500/15 bg-amber-500/5'>
                <Command className='size-6 text-amber-500' />
              </div>
              <h2 className='text-xl font-bold'>
                {t('Slash commands')}
              </h2>
            </div>
            <div className='grid gap-2 md:grid-cols-2'>
              {[
                { cmd: '/login', desc: 'Browser OAuth login' },
                { cmd: '/switch codex|claude', desc: 'Switch active tool' },
                { cmd: '/model <name>', desc: 'Change default model' },
                { cmd: '/update [codex|claude]', desc: 'Download / update tools' },
                { cmd: '/status', desc: 'Show configuration summary' },
                { cmd: '/help', desc: 'Show usage help' },
                { cmd: '/clear', desc: 'Clear main panel output' },
                { cmd: '/quit', desc: 'Exit program' },
              ].map((item) => (
                <div
                  key={item.cmd}
                  className='border-border/30 bg-background/50 flex items-center gap-4 rounded-lg border px-4 py-3'
                >
                  <code className='text-primary shrink-0 font-mono text-sm font-medium'>
                    {item.cmd}
                  </code>
                  <span className='text-muted-foreground text-sm'>
                    {t(item.desc)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </AnimateInView>

        {/* CTA */}
        <AnimateInView delay={100} className='text-center'>
          <div className='border-border/40 bg-muted/20 rounded-2xl border p-10'>
            <Terminal className='text-muted-foreground/50 mx-auto size-10' />
            <h2 className='mt-4 text-2xl font-bold'>
              {t('Start coding with Huayu')}
            </h2>
            <p className='text-muted-foreground mx-auto mt-3 max-w-lg'>
              {t(
                'One-line install, zero dependencies. Codex and Claude Code in a single terminal interface.'
              )}
            </p>
            <div className='mt-6 flex flex-wrap items-center justify-center gap-3'>
              <Button
                className='group rounded-lg'
                render={
                  <a
                    href='https://github.com/BaizorAI/huayu'
                    target='_blank'
                    rel='noopener noreferrer'
                  />
                }
              >
                {t('GitHub repository')}
                <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
              </Button>
              <Button
                variant='outline'
                className='border-border/50 hover:border-border hover:bg-muted/50 rounded-lg'
                render={
                  <a
                    href='https://github.com/BaizorAI/huayu/releases'
                    target='_blank'
                    rel='noopener noreferrer'
                  />
                }
              >
                {t('All releases')}
              </Button>
              <Button
                variant='outline'
                className='border-border/50 hover:border-border hover:bg-muted/50 rounded-lg'
                render={<Link to='/' />}
              >
                {t('Back to home')}
              </Button>
            </div>
          </div>
        </AnimateInView>
      </div>
    </PublicLayout>
  )
}

export { Huayu }
