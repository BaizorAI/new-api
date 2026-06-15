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
import { useQuery } from '@tanstack/react-query'
import {
  Sparkles,
  Globe,
  GraduationCap,
  MonitorSmartphone,
  BookOpen,
  Zap,
  Shield,
  ArrowRight,
  Users,
  Target,
  Lightbulb,
  MapPin,
  Mail,
  Layers,
  BarChart3,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { Markdown } from '@/components/ui/markdown'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { PublicLayout } from '@/components/layout'
import { AnimateInView } from '@/components/animate-in-view'
import { useStatus } from '@/hooks/use-status'
import { getAboutContent } from './api'

function isValidUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function isLikelyHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

const features = [
  {
    icon: <Zap className='size-5 text-blue-500' />,
    title: 'AI 智能辅助',
    desc: '基于大语言模型的智能答疑、个性化学习路径推荐与自动作业批改，为每位学习者提供专属导师般的指导。',
  },
  {
    icon: <Globe className='size-5 text-violet-500' />,
    title: '多模态教学资源',
    desc: '整合文字、语音、视频、动画等丰富媒体资源，构建沉浸式中文学习环境，让知识变得生动有趣。',
  },
  {
    icon: <MonitorSmartphone className='size-5 text-emerald-500' />,
    title: '智慧教室融合',
    desc: '线上线下一体化教学管理，支持实时课堂互动、分组讨论、即时测验与学情反馈，打造高效智慧课堂。',
  },
  {
    icon: <GraduationCap className='size-5 text-amber-500' />,
    title: '智能评估系统',
    desc: '覆盖听、说、读、写全技能的综合评测体系，基于AI的自动化评分与学情分析报告，精准定位学习薄弱点。',
  },
  {
    icon: <Users className='size-5 text-rose-500' />,
    title: '团队协作',
    desc: '多教师管理、学生分组与灵活权限分配，支持机构级多校区、多班级统一管理。',
  },
  {
    icon: <Shield className='size-5 text-cyan-500' />,
    title: '数据安全',
    desc: '企业级数据加密与隐私保护，完善的权限管理体系，确保教学过程与学习者数据安全无忧。',
  },
]

const scenarios = [
  {
    title: '高校国际中文教育',
    desc: '为高校国际教育学院提供完整的汉语作为第二语言教学解决方案，覆盖初级到高级各阶段课程。',
  },
  {
    title: '华文教育机构',
    desc: '助力海外华文学校与培训机构实现数字化转型，提升教学效率与学习者满意度。',
  },
  {
    title: '企业中文培训',
    desc: '为跨国企业员工的汉语培训提供智能化平台，支持商务汉语、日常交际等定制化课程。',
  },
  {
    title: '个人自主学习',
    desc: '为中文爱好者提供个性化学习路径与AI陪练，随时随地享受高质量的中文学习体验。',
  },
]

const stats = [
  { num: '50+', label: '合作高校与机构' },
  { num: '100万+', label: '服务学习者' },
  { num: '4', label: '核心技能覆盖' },
  { num: '99%', label: '教学满意度' },
]

function EmptyAboutState() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const currentYear = new Date().getFullYear()

  return (
    <div className='mx-auto max-w-5xl space-y-16 py-12 md:py-20'>
      {/* Hero */}
      <AnimateInView className='text-center'>
        <div className='mb-6 flex justify-center'>
          <div className='flex size-20 items-center justify-center rounded-3xl border border-blue-500/15 bg-blue-500/5 shadow-sm'>
            <Sparkles className='size-10 text-blue-500' />
          </div>
        </div>
        <h1 className='text-4xl font-bold tracking-tight md:text-5xl'>
          白泽中华文化AI平台
        </h1>
        <p className='text-muted-foreground mx-auto mt-4 max-w-2xl text-lg leading-relaxed'>
          用「通晓万物、洞悉智慧」的AI力量，为全球中文学习者带来智能、全面、个性化的教学指导。
        </p>
        <div className='mt-8 flex items-center justify-center gap-3'>
          <Button className='group rounded-lg' render={<Link to='/docs' />}>
            查看文档
            <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
          </Button>
          <Button
            variant='outline'
            className='border-border/50 hover:border-border hover:bg-muted/50 rounded-lg'
            render={<Link to='/' />}
          >
            返回首页
          </Button>
        </div>
      </AnimateInView>

      {/* Stats */}
      <AnimateInView delay={100}>
        <div className='border-border/40 bg-muted/20 rounded-2xl border p-8'>
          <div className='grid grid-cols-2 gap-6 md:grid-cols-4'>
            {stats.map((s) => (
              <div key={s.label} className='text-center'>
                <div className='text-3xl font-bold tracking-tight text-foreground'>
                  {s.num}
                </div>
                <div className='text-muted-foreground mt-1 text-sm'>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </AnimateInView>

      {/* Mission */}
      <AnimateInView delay={100}>
        <div className='border-border/40 bg-muted/20 relative overflow-hidden rounded-2xl border p-8 md:p-10'>
          <div
            aria-hidden
            className='pointer-events-none absolute -top-20 -right-20 size-64 opacity-20 dark:opacity-10'
            style={{
              background:
                'radial-gradient(circle, oklch(0.65 0.15 250 / 60%) 0%, transparent 70%)',
            }}
          />
          <div className='relative flex flex-col gap-6 md:flex-row md:items-center md:gap-10'>
            <div className='shrink-0'>
              <div className='flex size-14 items-center justify-center rounded-2xl border border-amber-500/15 bg-amber-500/5'>
                <Target className='size-7 text-amber-500' />
              </div>
            </div>
            <div>
              <h2 className='text-xl font-bold'>我们的使命</h2>
              <p className='text-muted-foreground mt-2 leading-relaxed'>
                白泽中华文化AI平台由白泽中华文化AI实验室倾力打造，致力于将前沿人工智能技术与国际中文教育深度融合。
                我们相信，每一位中文学习者都值得拥有个性化、智能化、全方位的学习体验。
                通过AI的力量，我们让汉语听、说、读、写教学变得更加高效、生动、有趣，
                助力中华文化走向世界，连接全球学习者的心。
              </p>
            </div>
          </div>
        </div>
      </AnimateInView>

      {/* Features Grid */}
      <section>
        <AnimateInView className='mb-10 text-center'>
          <h2 className='text-2xl font-bold tracking-tight md:text-3xl'>
            核心能力
          </h2>
          <p className='text-muted-foreground mt-2'>
            六大核心模块，构建完整的智慧中文教学生态
          </p>
        </AnimateInView>
        <div className='grid gap-5 md:grid-cols-2 lg:grid-cols-3'>
          {features.map((f, i) => (
            <AnimateInView key={f.title} delay={i * 80} animation='fade-up'>
              <div className='border-border/40 bg-muted/20 group hover:bg-muted/30 h-full rounded-xl border p-6 transition-colors duration-300'>
                <div className='mb-4 flex items-center gap-3'>
                  <div className='flex size-10 items-center justify-center rounded-xl border border-border/40 bg-background shadow-sm'>
                    {f.icon}
                  </div>
                  <h3 className='font-semibold'>{f.title}</h3>
                </div>
                <p className='text-muted-foreground text-sm leading-relaxed'>
                  {f.desc}
                </p>
              </div>
            </AnimateInView>
          ))}
        </div>
      </section>

      {/* Scenarios */}
      <section>
        <AnimateInView className='mb-10 text-center'>
          <h2 className='text-2xl font-bold tracking-tight md:text-3xl'>
            应用场景
          </h2>
          <p className='text-muted-foreground mt-2'>
            多元化的教学场景，满足不同层次的中文学习需求
          </p>
        </AnimateInView>
        <div className='grid gap-5 md:grid-cols-2'>
          {scenarios.map((s, i) => (
            <AnimateInView key={s.title} delay={i * 100} animation='fade-up'>
              <div className='border-border/40 bg-muted/20 group hover:bg-muted/30 h-full rounded-xl border p-6 transition-colors duration-300'>
                <div className='mb-3 flex items-center gap-3'>
                  <Layers className='text-primary size-5' />
                  <h3 className='font-semibold'>{s.title}</h3>
                </div>
                <p className='text-muted-foreground text-sm leading-relaxed'>
                  {s.desc}
                </p>
              </div>
            </AnimateInView>
          ))}
        </div>
      </section>

      {/* Legend */}
      <AnimateInView delay={100}>
        <div className='border-border/40 bg-muted/20 rounded-2xl border p-8 md:p-10'>
          <div className='flex flex-col gap-6 md:flex-row md:items-start md:gap-10'>
            <div className='shrink-0'>
              <div className='flex size-14 items-center justify-center rounded-2xl border border-blue-500/15 bg-blue-500/5'>
                <BookOpen className='size-7 text-blue-500' />
              </div>
            </div>
            <div className='flex-1'>
              <h2 className='text-xl font-bold'>「白泽」的传说与寓意</h2>
              <div className='text-muted-foreground mt-4 space-y-3 leading-relaxed'>
                <p>
                  在中国古代神话中，白泽是地位崇高的祥瑞神兽，仅次于麒麟、凤凰、龙等顶级瑞兽。
                  传说它通晓天下万物之情，能说人话，知晓所有鬼神精怪的名字、形貌与降服之法。
                  黄帝曾亲往请教，将其所述记录成《白泽图》，以辨天下妖邪、护佑苍生平安。
                </p>
                <p>
                  白泽象征着<strong>通晓万物、智慧洞察</strong>，亦代表着
                  <strong>逢凶化吉、辟邪护佑</strong>。在盛世明君治下才会现世，是太平盛世的瑞兆。
                </p>
                <p>
                  今天，我们将「白泽」之名赋予AI教育平台，寓意以人工智能之智，
                  如白泽般<strong>无所不知、明察幽微</strong>，为全球中文学习者带来智慧、祥瑞与全面指导——
                  让每一位学习者都能在中文世界中<strong>逢凶化吉、学而有道</strong>。
                </p>
              </div>
            </div>
          </div>
        </div>
      </AnimateInView>

      {/* Contact */}
      <AnimateInView delay={100}>
        <div className='border-border/40 bg-muted/20 rounded-2xl border p-8 md:p-10'>
          <div className='flex flex-col gap-6 md:flex-row md:items-start md:gap-10'>
            <div className='shrink-0'>
              <div className='flex size-14 items-center justify-center rounded-2xl border border-emerald-500/15 bg-emerald-500/5'>
                <Mail className='size-7 text-emerald-500' />
              </div>
            </div>
            <div className='flex-1'>
              <h2 className='text-xl font-bold'>联系我们</h2>
              <p className='text-muted-foreground mt-2 leading-relaxed'>
                如果您是高校、华文教育机构或企业，希望了解白泽中华文化AI平台的合作方案，
                欢迎通过以下方式与我们取得联系。我们期待与您携手，共同推动国际中文教育的智能化发展。
              </p>
              <div className='mt-4 flex flex-wrap gap-4 text-sm'>
                <a
                  href='https://github.com/BaizorAI/new-api'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-primary hover:underline'
                >
                  GitHub 项目仓库
                </a>
                <span className='text-muted-foreground/40'>·</span>
                <a
                  href='https://github.com/BaizorAI'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-primary hover:underline'
                >
                  BaizorAI 社区
                </a>
              </div>
            </div>
          </div>
        </div>
      </AnimateInView>

      {/* CTA */}
      <AnimateInView delay={100} className='text-center'>
        <div className='border-border/40 bg-muted/20 rounded-2xl border p-10'>
          <BarChart3 className='text-muted-foreground/50 mx-auto size-10' />
          <h2 className='mt-4 text-2xl font-bold'>
            准备好开启智慧中文教学之旅了吗？
          </h2>
          <p className='text-muted-foreground mx-auto mt-3 max-w-lg'>
            无论您是高校教师、华文教育机构，还是中文学习爱好者，白泽中华文化AI平台都将成为您最得力的智能助手。
          </p>
          <div className='mt-6 flex items-center justify-center gap-3'>
            <Button className='group rounded-lg' render={<Link to='/docs' />}>
              阅读文档
              <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
            </Button>
            <Button
              variant='outline'
              className='border-border/50 hover:border-border hover:bg-muted/50 rounded-lg'
              render={<Link to='/' />}
            >
              返回首页
            </Button>
          </div>
        </div>
      </AnimateInView>

      {/* Footer attribution */}
      <div className='border-border/30 mt-8 border-t pt-8 text-center text-xs text-muted-foreground/60'>
        <p>
          <a
            href='https://github.com/BaizorAI/new-api'
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary hover:underline'
          >
            {t('NewAPI')}
          </a>{' '}
          © {currentYear}{' '}
          <a
            href='https://github.com/BaizorAI'
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary hover:underline'
          >
            {t('QuantumNous')}
          </a>{' '}
          {t('| Based on')}{' '}
          <a
            href='https://github.com/songquanpeng/one-api'
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary hover:underline'
          >
            {t('One API')}
          </a>{' '}
          © 2023{' '}
          <a
            href='https://github.com/songquanpeng'
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary hover:underline'
          >
            {t('JustSong')}
          </a>
        </p>
        <p className='mt-1'>
          {t('This project must be used in compliance with the')}{' '}
          <a
            href='https://github.com/BaizorAI/new-api/blob/main/LICENSE'
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary hover:underline'
          >
            {t('AGPL v3.0 License')}
          </a>
        </p>
        {status?.version && (
          <p className='mt-1'>{t('Version')}: {status.version}</p>
        )}
      </div>
    </div>
  )
}

export function About() {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: ['about-content'],
    queryFn: getAboutContent,
  })

  const rawContent = data?.data?.trim() ?? ''
  const hasContent = rawContent.length > 0
  const isUrl = hasContent && isValidUrl(rawContent)
  const isHtml = hasContent && !isUrl && isLikelyHtml(rawContent)

  if (isLoading) {
    return (
      <PublicLayout>
        <div className='mx-auto flex max-w-4xl flex-col gap-4 py-12'>
          <Skeleton className='h-8 w-[45%]' />
          <Skeleton className='h-4 w-full' />
          <Skeleton className='h-4 w-[90%]' />
          <Skeleton className='h-4 w-[80%]' />
        </div>
      </PublicLayout>
    )
  }

  if (!hasContent) {
    return (
      <PublicLayout>
        <EmptyAboutState />
      </PublicLayout>
    )
  }

  if (isUrl) {
    return (
      <PublicLayout showMainContainer={false}>
        <iframe
          src={rawContent}
          className='h-[calc(100vh-3.5rem)] w-full border-0'
          title={t('About')}
        />
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className='mx-auto max-w-6xl px-4 py-8'>
        {isHtml ? (
          <div
            className='prose prose-neutral dark:prose-invert max-w-none'
            dangerouslySetInnerHTML={{ __html: rawContent }}
          />
        ) : (
          <Markdown className='prose-neutral dark:prose-invert max-w-none'>
            {rawContent}
          </Markdown>
        )}
      </div>
    </PublicLayout>
  )
}
