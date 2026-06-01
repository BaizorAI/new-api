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

import React, { useEffect, useState } from 'react';
import { API, showError } from '../../helpers';
import { marked } from 'marked';
import { useTranslation } from 'react-i18next';
import { Typography, Card, Button } from '@douyinfe/semi-ui';
import {
  IconBookOpenStroked,
  IconGlobe,
  IconDesktop,
  IconStar,
  IconBolt,
  IconShield,
  IconUserGroup,
  IconBulb,
  IconArrowRight,
  IconMail,
  IconLayers,
  IconBarChartVStroked,
  IconFlag,
} from '@douyinfe/semi-icons';
import { Link } from 'react-router-dom';

const { Title, Paragraph, Text } = Typography;

const features = [
  {
    icon: <IconBolt size='large' style={{ color: 'var(--semi-color-primary)' }} />,
    title: 'AI 智能辅助',
    desc: '基于大语言模型的智能答疑、个性化学习路径推荐与自动作业批改，为每位学习者提供专属导师般的指导。',
  },
  {
    icon: <IconGlobe size='large' style={{ color: 'var(--semi-color-tertiary)' }} />,
    title: '多模态教学资源',
    desc: '整合文字、语音、视频、动画等丰富媒体资源，构建沉浸式中文学习环境，让知识变得生动有趣。',
  },
  {
    icon: <IconDesktop size='large' style={{ color: 'var(--semi-color-success)' }} />,
    title: '智慧教室融合',
    desc: '线上线下一体化教学管理，支持实时课堂互动、分组讨论、即时测验与学情反馈，打造高效智慧课堂。',
  },
  {
    icon: <IconStar size='large' style={{ color: 'var(--semi-color-warning)' }} />,
    title: '智能评估系统',
    desc: '覆盖听、说、读、写全技能的综合评测体系，基于AI的自动化评分与学情分析报告，精准定位学习薄弱点。',
  },
  {
    icon: <IconUserGroup size='large' style={{ color: 'var(--semi-color-danger)' }} />,
    title: '团队协作',
    desc: '多教师管理、学生分组与灵活权限分配，支持机构级多校区、多班级统一管理。',
  },
  {
    icon: <IconShield size='large' style={{ color: 'var(--semi-color-info)' }} />,
    title: '数据安全',
    desc: '企业级数据加密与隐私保护，完善的权限管理体系，确保教学过程与学习者数据安全无忧。',
  },
];

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
];

const stats = [
  { num: '50+', label: '合作高校与机构' },
  { num: '100万+', label: '服务学习者' },
  { num: '4', label: '核心技能覆盖' },
  { num: '99%', label: '教学满意度' },
];

const About = () => {
  const { t } = useTranslation();
  const [about, setAbout] = useState('');
  const [aboutLoaded, setAboutLoaded] = useState(false);
  const currentYear = new Date().getFullYear();

  const displayAbout = async () => {
    setAbout(localStorage.getItem('about') || '');
    const res = await API.get('/api/about');
    const { success, message, data } = res.data;
    if (success) {
      let aboutContent = data;
      if (!data.startsWith('https://')) {
        aboutContent = marked.parse(data);
      }
      setAbout(aboutContent);
      localStorage.setItem('about', aboutContent);
    } else {
      showError(message);
      setAbout(t('加载关于内容失败...'));
    }
    setAboutLoaded(true);
  };

  useEffect(() => {
    displayAbout().then();
  }, []);

  const customDescription = (
    <div style={{ textAlign: 'center', maxWidth: '960px', margin: '0 auto' }}>
      {/* Hero */}
      <div style={{ marginBottom: '40px' }}>
        <div
          style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 20px',
            borderRadius: '24px',
            background: 'var(--semi-color-fill-0)',
            border: '1px solid var(--semi-color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconBookOpenStroked size='extra-large' style={{ color: 'var(--semi-color-primary)' }} />
        </div>
        <Title heading={2} style={{ marginBottom: '12px' }}>白泽中华文化AI平台</Title>
        <Paragraph style={{ color: 'var(--semi-color-text-1)', maxWidth: '640px', margin: '0 auto', lineHeight: 1.6, fontSize: '16px' }}>
          用「通晓万物、洞悉智慧」的AI力量，为全球中文学习者带来智能、全面、个性化的教学指导。
        </Paragraph>
        <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <Link to='/docs'>
            <Button theme='solid' type='primary' icon={<IconArrowRight />}>
              查看文档
            </Button>
          </Link>
          <Link to='/'>
            <Button theme='borderless' type='tertiary'>
              返回首页
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <Card style={{ marginBottom: '32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '24px' }}>
          {stats.map((s) => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--semi-color-text-0)' }}>{s.num}</div>
              <div style={{ fontSize: '14px', color: 'var(--semi-color-text-2)', marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Mission */}
      <Card style={{ marginBottom: '32px', textAlign: 'left' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'var(--semi-color-fill-0)',
              border: '1px solid var(--semi-color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <IconFlag size='large' style={{ color: 'var(--semi-color-warning)' }} />
          </div>
          <div>
            <Title heading={4} style={{ marginBottom: '8px' }}>我们的使命</Title>
            <Paragraph style={{ color: 'var(--semi-color-text-1)', lineHeight: 1.8 }}>
              白泽中华文化AI平台由白泽中华文化AI实验室倾力打造，致力于将前沿人工智能技术与国际中文教育深度融合。
              我们相信，每一位中文学习者都值得拥有个性化、智能化、全方位的学习体验。
              通过AI的力量，我们让汉语听、说、读、写教学变得更加高效、生动、有趣，
              助力中华文化走向世界，连接全球学习者的心。
            </Paragraph>
          </div>
        </div>
      </Card>

      {/* Features */}
      <Title heading={4} style={{ marginBottom: '20px' }}>核心能力</Title>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px', textAlign: 'left' }}>
        {features.map((f) => (
          <Card key={f.title}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: 'var(--semi-color-fill-0)',
                  border: '1px solid var(--semi-color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {f.icon}
              </div>
              <Title heading={6} style={{ margin: 0 }}>{f.title}</Title>
            </div>
            <Paragraph style={{ color: 'var(--semi-color-text-1)', lineHeight: 1.6, fontSize: '14px' }}>
              {f.desc}
            </Paragraph>
          </Card>
        ))}
      </div>

      {/* Scenarios */}
      <Title heading={4} style={{ marginBottom: '20px' }}>应用场景</Title>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px', textAlign: 'left' }}>
        {scenarios.map((s) => (
          <Card key={s.title}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
              <IconLayers size='large' style={{ color: 'var(--semi-color-primary)' }} />
              <Title heading={6} style={{ margin: 0 }}>{s.title}</Title>
            </div>
            <Paragraph style={{ color: 'var(--semi-color-text-1)', lineHeight: 1.6, fontSize: '14px' }}>
              {s.desc}
            </Paragraph>
          </Card>
        ))}
      </div>

      {/* Legend */}
      <Card style={{ marginBottom: '32px', textAlign: 'left' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'var(--semi-color-fill-0)',
              border: '1px solid var(--semi-color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <IconBookOpenStroked size='large' style={{ color: 'var(--semi-color-primary)' }} />
          </div>
          <div>
            <Title heading={4} style={{ marginBottom: '12px' }}>「白泽」的传说与寓意</Title>
            <Paragraph style={{ color: 'var(--semi-color-text-1)', lineHeight: 1.8 }}>
              在中国古代神话中，白泽是地位崇高的祥瑞神兽，仅次于麒麟、凤凰、龙等顶级瑞兽。
              传说它通晓天下万物之情，能说人话，知晓所有鬼神精怪的名字、形貌与降服之法。
              黄帝曾亲往请教，将其所述记录成《白泽图》，以辨天下妖邪、护佑苍生平安。
            </Paragraph>
            <Paragraph style={{ color: 'var(--semi-color-text-1)', lineHeight: 1.8 }}>
              白泽象征着<Text strong>通晓万物、智慧洞察</Text>，亦代表着<Text strong>逢凶化吉、辟邪护佑</Text>。
              在盛世明君治下才会现世，是太平盛世的瑞兆。
            </Paragraph>
            <Paragraph style={{ color: 'var(--semi-color-text-1)', lineHeight: 1.8 }}>
              今天，我们将「白泽」之名赋予AI教育平台，寓意以人工智能之智，
              如白泽般<Text strong>无所不知、明察幽微</Text>，为全球中文学习者带来智慧、祥瑞与全面指导——
              让每一位学习者都能在中文世界中<Text strong>逢凶化吉、学而有道</Text>。
            </Paragraph>
          </div>
        </div>
      </Card>

      {/* Contact */}
      <Card style={{ marginBottom: '32px', textAlign: 'left' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'var(--semi-color-fill-0)',
              border: '1px solid var(--semi-color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <IconMail size='large' style={{ color: 'var(--semi-color-success)' }} />
          </div>
          <div>
            <Title heading={4} style={{ marginBottom: '8px' }}>联系我们</Title>
            <Paragraph style={{ color: 'var(--semi-color-text-1)', lineHeight: 1.8 }}>
              如果您是高校、华文教育机构或企业，希望了解白泽中华文化AI平台的合作方案，
              欢迎通过以下方式与我们取得联系。我们期待与您携手，共同推动国际中文教育的智能化发展。
            </Paragraph>
            <div style={{ marginTop: '12px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <a href='https://github.com/QuantumNous/new-api' target='_blank' rel='noopener noreferrer' className='!text-semi-color-primary'>
                GitHub 项目仓库
              </a>
              <a href='https://github.com/QuantumNous' target='_blank' rel='noopener noreferrer' className='!text-semi-color-primary'>
                QuantumNous 社区
              </a>
            </div>
          </div>
        </div>
      </Card>

      {/* CTA */}
      <Card style={{ marginBottom: '32px', textAlign: 'center' }}>
        <IconBarChartVStroked size='extra-large' style={{ color: 'var(--semi-color-text-2)', marginBottom: '12px' }} />
        <Title heading={4} style={{ marginBottom: '8px' }}>准备好开启智慧中文教学之旅了吗？</Title>
        <Paragraph style={{ color: 'var(--semi-color-text-1)', maxWidth: '560px', margin: '0 auto 20px', lineHeight: 1.6 }}>
          无论您是高校教师、华文教育机构，还是中文学习爱好者，白泽中华文化AI平台都将成为您最得力的智能助手。
        </Paragraph>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <Link to='/docs'>
            <Button theme='solid' type='primary' icon={<IconArrowRight />}>
              阅读文档
            </Button>
          </Link>
          <Link to='/'>
            <Button theme='borderless' type='tertiary'>
              返回首页
            </Button>
          </Link>
        </div>
      </Card>

      {/* Footer */}
      <div style={{ fontSize: '12px', color: 'var(--semi-color-text-2)', lineHeight: 1.8 }}>
        <p>
          <a href='https://github.com/QuantumNous/new-api' target='_blank' rel='noopener noreferrer' className='!text-semi-color-primary'>
            NewAPI
          </a>{' '}
          © {currentYear}{' '}
          <a href='https://github.com/QuantumNous' target='_blank' rel='noopener noreferrer' className='!text-semi-color-primary'>
            QuantumNous
          </a>{' '}
          | 基于{' '}
          <a href='https://github.com/songquanpeng/one-api' target='_blank' rel='noopener noreferrer' className='!text-semi-color-primary'>
            One API
          </a>{' '}
          © 2023{' '}
          <a href='https://github.com/songquanpeng' target='_blank' rel='noopener noreferrer' className='!text-semi-color-primary'>
            JustSong
          </a>
        </p>
        <p>
          本项目需在遵守{' '}
          <a href='https://www.gnu.org/licenses/agpl-3.0.html' target='_blank' rel='noopener noreferrer' className='!text-semi-color-primary'>
            AGPL v3.0 协议
          </a>{' '}
          的前提下使用
        </p>
      </div>
    </div>
  );

  return (
    <div className='mt-[60px] px-4 md:px-8 py-8'>
      {aboutLoaded && about === '' ? (
        <div className='flex justify-center items-center min-h-[60vh] p-8'>
          {customDescription}
        </div>
      ) : (
        <>
          {about.startsWith('https://') ? (
            <iframe
              src={about}
              style={{ width: '100%', height: '100vh', border: 'none' }}
            />
          ) : (
            <div
              style={{ fontSize: 'larger' }}
              dangerouslySetInnerHTML={{ __html: about }}
            ></div>
          )}
        </>
      )}
    </div>
  );
};

export default About;
