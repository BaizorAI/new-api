/*
Copyright (C) 2025 QuantumNous

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

import React from 'react';
import { Typography, Card } from '@douyinfe/semi-ui';

const { Title, Paragraph, Text } = Typography;

const Docs = () => {
  return (
    <div className='mt-[60px] px-4 md:px-8 py-8 max-w-4xl mx-auto'>
      <div className='text-center mb-10'>
        <Title heading={2}>白泽中华文化AI平台文档</Title>
        <Paragraph style={{ marginTop: '12px', color: 'var(--semi-color-text-1)' }}>
          了解白泽平台的教学理念、核心功能与使用方法，开启AI赋能的国际中文教育之旅。
        </Paragraph>
      </div>

      <Card style={{ marginBottom: '24px' }}>
        <Title heading={4} style={{ marginBottom: '12px' }}>平台简介</Title>
        <Paragraph style={{ lineHeight: 1.8 }}>
          白泽中华文化AI平台是由白泽中华文化AI实验室开发的一套针对国际中文教育（即汉语作为第二语言教学）的AI智能教学系统。
          它深度融合了教学管理软件系统、AI智能辅助服务、多模态教学资源（文字、语音、视频等）与智慧教室硬件设备，
          主要服务于国内外高校、华文教育机构，帮助开展汉语听、说、读、写教学、课堂互动、作业考试、智能评估等功能。
        </Paragraph>
      </Card>

      <Title heading={4} style={{ marginBottom: '16px' }}>核心功能</Title>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <Card>
          <Title heading={5}>AI 智能辅助</Title>
          <Paragraph style={{ color: 'var(--semi-color-text-1)', lineHeight: 1.6 }}>
            基于大语言模型的智能答疑、个性化学习路径推荐与自动作业批改，为每位学习者提供专属导师般的指导。
          </Paragraph>
        </Card>
        <Card>
          <Title heading={5}>多模态教学资源</Title>
          <Paragraph style={{ color: 'var(--semi-color-text-1)', lineHeight: 1.6 }}>
            整合文字、语音、视频、动画等丰富媒体资源，构建沉浸式中文学习环境，让知识变得生动有趣。
          </Paragraph>
        </Card>
        <Card>
          <Title heading={5}>智慧教室融合</Title>
          <Paragraph style={{ color: 'var(--semi-color-text-1)', lineHeight: 1.6 }}>
            线上线下一体化教学管理，支持实时课堂互动、分组讨论、即时测验与学情反馈，打造高效智慧课堂。
          </Paragraph>
        </Card>
        <Card>
          <Title heading={5}>智能评估系统</Title>
          <Paragraph style={{ color: 'var(--semi-color-text-1)', lineHeight: 1.6 }}>
            覆盖听、说、读、写全技能的综合评测体系，基于AI的自动化评分与学情分析报告，精准定位学习薄弱点。
          </Paragraph>
        </Card>
      </div>

      <Card style={{ marginBottom: '24px' }}>
        <Title heading={4} style={{ marginBottom: '12px' }}>「白泽」的寓意</Title>
        <Paragraph style={{ lineHeight: 1.8 }}>
          在中国古代神话传说中，白泽是非常著名的祥瑞神兽，地位仅次于麒麟、凤凰、龙等顶级瑞兽。
          白泽能说人话，通达天下万物之情，知道所有鬼神、精怪的名字、形貌和降服/驱除方法。
          传说黄帝曾向它请教，并将其所述记录成《白泽图》。
        </Paragraph>
        <Paragraph style={{ lineHeight: 1.8 }}>
          白泽的主要寓意包括：通晓万物、智慧洞察；逢凶化吉、辟邪护佑；圣王/盛世象征；以及智慧与知识的化身。
          现代常被引申为「博学多闻、洞悉一切」的象征，尤其在AI、教育、科技领域命名时，
          强调「智能、通透、洞察」。取名「白泽」，寓意用超级智能帮助全球学习中文的人「逢凶化吉、学而有道」。
        </Paragraph>
      </Card>

      <Card style={{ marginBottom: '24px' }}>
        <Title heading={4} style={{ marginBottom: '12px' }}>快速开始</Title>
        <ol style={{ lineHeight: 1.8, paddingLeft: '20px', color: 'var(--semi-color-text-0)' }}>
          <li><Text strong>注册账号：</Text>点击「立即体验」注册教师或机构账号，完成基本信息填写。</li>
          <li><Text strong>创建课程：</Text>在控制台中创建课程，导入教学资源，配置班级与学生信息。</li>
          <li><Text strong>开始教学：</Text>利用AI智能辅助开展个性化教学，结合多模态资源与学生实时互动。</li>
          <li><Text strong>评估优化：</Text>通过智能评估系统追踪学习进度，生成学情分析报告，持续优化教学策略。</li>
        </ol>
      </Card>

      <Card>
        <Title heading={4} style={{ marginBottom: '12px' }}>技术支持</Title>
        <Paragraph style={{ lineHeight: 1.8 }}>
          如在使用白泽中华文化AI平台过程中遇到任何问题，或希望了解更多合作信息，
          请访问我们的项目仓库或社区获取帮助。
        </Paragraph>
        <div style={{ marginTop: '12px' }}>
          <a
            href='https://github.com/QuantumNous/new-api'
            target='_blank'
            rel='noopener noreferrer'
            className='!text-semi-color-primary'
          >
            New API 项目仓库
          </a>
          <span style={{ margin: '0 8px', color: 'var(--semi-color-text-2)' }}>·</span>
          <a
            href='https://github.com/QuantumNous'
            target='_blank'
            rel='noopener noreferrer'
            className='!text-semi-color-primary'
          >
            QuantumNous 社区
          </a>
        </div>
      </Card>
    </div>
  );
};

export default Docs;
