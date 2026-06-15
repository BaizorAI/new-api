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
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { PublicLayout } from '@/components/layout'
import { BookOpen, Sparkles, GraduationCap, MonitorSmartphone, Globe, Zap, BarChart3 } from 'lucide-react'
import { AnimateInView } from '@/components/animate-in-view'

export const Route = createFileRoute('/docs/')({
  component: DocsPage,
})

function DocsPage() {
  const { t } = useTranslation()

  return (
    <PublicLayout>
      <div className='mx-auto max-w-4xl px-4 py-12 md:py-16'>
        <AnimateInView className='mb-12 text-center'>
          <div className='mb-4 flex justify-center'>
            <div className='flex size-16 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/5'>
              <BookOpen className='size-8 text-blue-500' />
            </div>
          </div>
          <h1 className='text-3xl font-bold tracking-tight md:text-4xl'>
            白泽中华文化AI平台文档
          </h1>
          <p className='text-muted-foreground mx-auto mt-4 max-w-xl text-base'>
            了解白泽平台的教学理念、核心功能与使用方法，开启AI赋能的国际中文教育之旅。
          </p>
        </AnimateInView>

        <div className='space-y-10'>
          {/* 平台简介 */}
          <section>
            <h2 className='mb-4 text-xl font-bold'>平台简介</h2>
            <div className='border-border/40 bg-muted/20 rounded-xl border p-6'>
              <p className='text-muted-foreground leading-relaxed'>
                白泽中华文化AI平台是由白泽中华文化AI实验室开发的一套针对国际中文教育（即汉语作为第二语言教学）的AI智能教学系统。
                它深度融合了教学管理软件系统、AI智能辅助服务、多模态教学资源（文字、语音、视频等）与智慧教室硬件设备，
                主要服务于国内外高校、华文教育机构，帮助开展汉语听、说、读、写教学、课堂互动、作业考试、智能评估等功能。
              </p>
            </div>
          </section>

          {/* 核心功能 */}
          <section>
            <h2 className='mb-4 text-xl font-bold'>核心功能</h2>
            <div className='grid gap-4 md:grid-cols-2'>
              <div className='border-border/40 bg-muted/20 flex flex-col gap-3 rounded-xl border p-5'>
                <div className='flex items-center gap-2'>
                  <div className='flex size-8 items-center justify-center rounded-lg bg-blue-500/10'>
                    <Zap className='size-4 text-blue-500' />
                  </div>
                  <h3 className='font-semibold'>AI 智能辅助</h3>
                </div>
                <p className='text-muted-foreground text-sm leading-relaxed'>
                  基于大语言模型的智能答疑、个性化学习路径推荐与自动作业批改，为每位学习者提供专属导师般的指导。
                </p>
              </div>
              <div className='border-border/40 bg-muted/20 flex flex-col gap-3 rounded-xl border p-5'>
                <div className='flex items-center gap-2'>
                  <div className='flex size-8 items-center justify-center rounded-lg bg-violet-500/10'>
                    <Globe className='size-4 text-violet-500' />
                  </div>
                  <h3 className='font-semibold'>多模态教学资源</h3>
                </div>
                <p className='text-muted-foreground text-sm leading-relaxed'>
                  整合文字、语音、视频、动画等丰富媒体资源，构建沉浸式中文学习环境，让知识变得生动有趣。
                </p>
              </div>
              <div className='border-border/40 bg-muted/20 flex flex-col gap-3 rounded-xl border p-5'>
                <div className='flex items-center gap-2'>
                  <div className='flex size-8 items-center justify-center rounded-lg bg-emerald-500/10'>
                    <MonitorSmartphone className='size-4 text-emerald-500' />
                  </div>
                  <h3 className='font-semibold'>智慧教室融合</h3>
                </div>
                <p className='text-muted-foreground text-sm leading-relaxed'>
                  线上线下一体化教学管理，支持实时课堂互动、分组讨论、即时测验与学情反馈，打造高效智慧课堂。
                </p>
              </div>
              <div className='border-border/40 bg-muted/20 flex flex-col gap-3 rounded-xl border p-5'>
                <div className='flex items-center gap-2'>
                  <div className='flex size-8 items-center justify-center rounded-lg bg-amber-500/10'>
                    <BarChart3 className='size-4 text-amber-500' />
                  </div>
                  <h3 className='font-semibold'>智能评估系统</h3>
                </div>
                <p className='text-muted-foreground text-sm leading-relaxed'>
                  覆盖听、说、读、写全技能的综合评测体系，基于AI的自动化评分与学情分析报告，精准定位学习薄弱点。
                </p>
              </div>
            </div>
          </section>

          {/* 白泽寓意 */}
          <section>
            <h2 className='mb-4 text-xl font-bold'>「白泽」的寓意</h2>
            <div className='border-border/40 bg-muted/20 rounded-xl border p-6'>
              <div className='mb-4 flex items-center gap-2'>
                <Sparkles className='size-5 text-amber-500' />
                <h3 className='font-semibold'>神话中的白泽</h3>
              </div>
              <p className='text-muted-foreground mb-4 leading-relaxed'>
                在中国古代神话传说中，白泽是非常著名的祥瑞神兽，地位仅次于麒麟、凤凰、龙等顶级瑞兽。
                白泽能说人话，通达天下万物之情，知道所有鬼神、精怪的名字、形貌和降服/驱除方法。
                传说黄帝曾向它请教，并将其所述记录成《白泽图》。
              </p>
              <div className='mb-4 flex items-center gap-2'>
                <GraduationCap className='size-5 text-blue-500' />
                <h3 className='font-semibold'>现代象征</h3>
              </div>
              <p className='text-muted-foreground leading-relaxed'>
                白泽的主要寓意包括：通晓万物、智慧洞察；逢凶化吉、辟邪护佑；圣王/盛世象征；以及智慧与知识的化身。
                现代常被引申为「博学多闻、洞悉一切」的象征，尤其在AI、教育、科技领域命名时，
                强调「智能、通透、洞察」。取名「白泽」，寓意用超级智能帮助全球学习中文的人「逢凶化吉、学而有道」。
              </p>
            </div>
          </section>

          {/* 快速开始 */}
          <section>
            <h2 className='mb-4 text-xl font-bold'>快速开始</h2>
            <div className='border-border/40 bg-muted/20 rounded-xl border p-6'>
              <ol className='text-muted-foreground list-decimal space-y-3 pl-5 leading-relaxed'>
                <li>
                  <strong className='text-foreground'>注册账号：</strong>
                  点击「立即体验」注册教师或机构账号，完成基本信息填写。
                </li>
                <li>
                  <strong className='text-foreground'>创建课程：</strong>
                  在控制台中创建课程，导入教学资源，配置班级与学生信息。
                </li>
                <li>
                  <strong className='text-foreground'>开始教学：</strong>
                  利用AI智能辅助开展个性化教学，结合多模态资源与学生实时互动。
                </li>
                <li>
                  <strong className='text-foreground'>评估优化：</strong>
                  通过智能评估系统追踪学习进度，生成学情分析报告，持续优化教学策略。
                </li>
              </ol>
            </div>
          </section>

          {/* 技术支持 */}
          <section>
            <h2 className='mb-4 text-xl font-bold'>技术支持</h2>
            <div className='border-border/40 bg-muted/20 rounded-xl border p-6'>
              <p className='text-muted-foreground leading-relaxed'>
                如在使用白泽中华文化AI平台过程中遇到任何问题，或希望了解更多合作信息，
                请通过以下方式联系我们：
              </p>
              <div className='mt-4 flex flex-wrap gap-3'>
                <a
                  href='https://github.com/baizorai/new-api'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-primary hover:underline text-sm'
                >
                  New API 项目仓库
                </a>
                <span className='text-muted-foreground'>·</span>
                <a
                  href='https://github.com/BaizorAI'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-primary hover:underline text-sm'
                >
                  BaizorAI 社区
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>
    </PublicLayout>
  )
}
