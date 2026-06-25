/**
 * 文章大纲生成器
 * 使用 Claude API 生成SEO友好的文章结构
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!config.anthropic.apiKey || config.anthropic.apiKey === 'sk-ant-xxx') {
    return null;
  }
  if (!client) {
    client = new Anthropic({
      apiKey: config.anthropic.apiKey,
      baseURL: config.anthropic.baseUrl || undefined,
    });
  }
  return client;
}

export interface ArticleOutline {
  title: string;
  targetKeyword: string;
  metaDescription: string;
  h1: string;
  sections: OutlineSection[];
  estimatedWordCount: number;
  targetAudience: string;
  seoAngles: string[];
}

export interface OutlineSection {
  heading: string;
  level: 'h2' | 'h3';
  keyPoints: string[];
  suggestedWordCount: number;
  affiliateOpportunity: boolean;
}

/**
 * 生成文章大纲
 */
export async function generateOutline(
  keyword: string,
  options: {
    contentType?: 'review' | 'guide' | 'comparison' | 'listicle';
    wordCount?: number;
    competitors?: string[];
  } = {}
): Promise<ArticleOutline> {
  console.log(`  📝 生成大纲: "${keyword}"`);

  const anthClient = getClient();

  if (anthClient) {
    return generateWithAI(anthClient, keyword, options);
  }

  // 无API Key时的模板大纲
  return generateTemplateOutline(keyword, options);
}

async function generateWithAI(
  client: Anthropic,
  keyword: string,
  options: {
    contentType?: string;
    wordCount?: number;
    competitors?: string[];
  }
): Promise<ArticleOutline> {
  const contentType = options.contentType || 'guide';
  const wordCount = options.wordCount || 2000;

  const prompt = `你是一位SEO内容策略专家。请为关键词"${keyword}"设计一个高质量文章大纲。

文章类型: ${contentType}
目标字数: ${wordCount}字
目标受众: 中国互联网用户

请返回JSON格式的大纲，包含:
{
  "title": "SEO优化的标题(含关键词, 30-60字)",
  "metaDescription": "吸引点击的描述(120-160字)",
  "h1": "H1标题",
  "sections": [
    {
      "heading": "段落标题",
      "level": "h2或h3",
      "keyPoints": ["要点1", "要点2"],
      "suggestedWordCount": 200,
      "affiliateOpportunity": true/false
    }
  ],
  "seoAngles": ["SEO角度1", "SEO角度2"],
  "targetAudience": "目标读者描述"
}

要求:
- 至少6-8个章节
- 包含购买建议/推荐章节(用于联盟营销)
- 包含常见问题解答章节
- 每个章节至少3个要点
- 标题要有吸引力和搜索意图匹配`;

  const response = await client.messages.create({
    model: 'deepseek-v4-pro',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map(block => block.text)
    .join('');
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]) as ArticleOutline;
    } catch {
      // fallback
    }
  }

  return generateTemplateOutline(keyword, options);
}

function generateTemplateOutline(
  keyword: string,
  options: { contentType?: string; wordCount?: number }
): ArticleOutline {
  const contentType = options.contentType || 'guide';

  const templates: Record<string, Partial<ArticleOutline>> = {
    review: {
      h1: `${keyword}深度评测：带你全面了解`,
      sections: [
        { heading: '开篇：为什么关注这个问题', level: 'h2', keyPoints: ['痛点引入', '核心观点'], suggestedWordCount: 150, affiliateOpportunity: false },
        { heading: '核心要点速览', level: 'h2', keyPoints: ['要点一', '要点二', '要点三'], suggestedWordCount: 200, affiliateOpportunity: false },
        { heading: `市面主流${keyword.replace('推荐', '').replace('评测', '')}对比分析`, level: 'h2', keyPoints: ['产品A分析', '产品B分析', '产品C分析'], suggestedWordCount: 500, affiliateOpportunity: true },
        { heading: '选购指南：如何挑选最适合你的', level: 'h2', keyPoints: ['预算因素', '使用场景', '品牌售后'], suggestedWordCount: 400, affiliateOpportunity: true },
        { heading: 'TOP推荐榜单', level: 'h2', keyPoints: ['性价比之选', '高端之选', '入门之选'], suggestedWordCount: 400, affiliateOpportunity: true },
        { heading: '使用技巧与注意事项', level: 'h2', keyPoints: ['技巧一', '技巧二', '注意点'], suggestedWordCount: 300, affiliateOpportunity: false },
        { heading: '常见问题解答（FAQ）', level: 'h2', keyPoints: ['Q1', 'Q2', 'Q3'], suggestedWordCount: 300, affiliateOpportunity: false },
        { heading: '总结与最终推荐', level: 'h2', keyPoints: ['回顾要点', '最终推荐'], suggestedWordCount: 150, affiliateOpportunity: true },
      ],
    },
    guide: {
      h1: `${keyword}完全指南：从入门到精通`,
      sections: [
        { heading: '引言：这篇文章能帮你解决什么', level: 'h2', keyPoints: ['适用人群', '你将学到什么'], suggestedWordCount: 150, affiliateOpportunity: false },
        { heading: `什么是${keyword}？基础知识科普`, level: 'h2', keyPoints: ['定义', '发展背景', '核心概念'], suggestedWordCount: 300, affiliateOpportunity: false },
        { heading: '为什么这很重要？5个关键原因', level: 'h2', keyPoints: ['原因1', '原因2', '原因3', '原因4', '原因5'], suggestedWordCount: 350, affiliateOpportunity: false },
        { heading: `2025最新${keyword}攻略（7个步骤）`, level: 'h2', keyPoints: ['步骤1', '步骤2', '步骤3', '步骤4', '步骤5', '步骤6', '步骤7'], suggestedWordCount: 600, affiliateOpportunity: false },
        { heading: '必备工具/产品推荐', level: 'h2', keyPoints: ['推荐1', '推荐2', '推荐3'], suggestedWordCount: 400, affiliateOpportunity: true },
        { heading: '常见错误与避坑指南', level: 'h2', keyPoints: ['错误1', '错误2', '错误3'], suggestedWordCount: 300, affiliateOpportunity: false },
        { heading: '进阶技巧：从熟练到精通', level: 'h2', keyPoints: ['进阶1', '进阶2'], suggestedWordCount: 300, affiliateOpportunity: false },
        { heading: '常见问题解答（FAQ）', level: 'h2', keyPoints: ['Q1', 'Q2', 'Q3', 'Q4'], suggestedWordCount: 300, affiliateOpportunity: false },
        { heading: '总结与行动建议', level: 'h2', keyPoints: ['核心要点回顾', '下一步行动'], suggestedWordCount: 150, affiliateOpportunity: true },
      ],
    },
    comparison: {
      h1: `${keyword}终极对决：全方位对比帮你做选择`,
      sections: [
        { heading: '引言：选A还是选B？', level: 'h2', keyPoints: ['选择困境', '文章目标'], suggestedWordCount: 150, affiliateOpportunity: false },
        { heading: '对比维度总览', level: 'h2', keyPoints: ['维度1', '维度2', '维度3', '维度4'], suggestedWordCount: 200, affiliateOpportunity: false },
        { heading: '价格对比', level: 'h2', keyPoints: ['方案A价格', '方案B价格'], suggestedWordCount: 250, affiliateOpportunity: true },
        { heading: '性能/功能对比', level: 'h2', keyPoints: ['功能对比表', '实测数据'], suggestedWordCount: 400, affiliateOpportunity: false },
        { heading: '用户体验对比', level: 'h2', keyPoints: ['易用性', '售后服务'], suggestedWordCount: 300, affiliateOpportunity: false },
        { heading: '适合人群分析', level: 'h2', keyPoints: ['A适合谁', 'B适合谁'], suggestedWordCount: 250, affiliateOpportunity: true },
        { heading: '性价比分析', level: 'h2', keyPoints: ['长期成本', '隐藏费用'], suggestedWordCount: 300, affiliateOpportunity: true },
        { heading: '最终结论：我的推荐', level: 'h2', keyPoints: ['综合评分', '最终选择'], suggestedWordCount: 200, affiliateOpportunity: true },
      ],
    },
    listicle: {
      h1: `${keyword}排行榜：2025年度最佳TOP10推荐`,
      sections: [
        { heading: '导读：如何评选的', level: 'h2', keyPoints: ['评选标准', '数据来源'], suggestedWordCount: 150, affiliateOpportunity: false },
        ...Array.from({ length: 10 }, (_, i) => ({
          heading: `第${i + 1}名：候选条目`,
          level: 'h2' as const,
          keyPoints: ['产品介绍', '核心亮点', '适用人群'],
          suggestedWordCount: 200,
          affiliateOpportunity: true,
        })),
        { heading: '横向对比总结', level: 'h2', keyPoints: ['对比表', '分析'], suggestedWordCount: 300, affiliateOpportunity: true },
        { heading: '选购建议', level: 'h2', keyPoints: ['按预算', '按需求'], suggestedWordCount: 300, affiliateOpportunity: true },
        { heading: '总结', level: 'h2', keyPoints: ['最佳推荐'], suggestedWordCount: 100, affiliateOpportunity: true },
      ],
    },
  };

  const template = templates[contentType] || templates.guide;

  return {
    title: `${keyword}终极指南：2025年最新攻略与推荐`,
    targetKeyword: keyword,
    metaDescription: `【2025年最新】${keyword}完整指南。专业评测+选购建议+避坑攻略，帮你做出最明智的选择。`,
    h1: template.h1 || `${keyword}完全指南`,
    sections: template.sections || templates.guide.sections!,
    estimatedWordCount: template.sections!.reduce((sum, s) => sum + s.suggestedWordCount, 0),
    targetAudience: `对${keyword}感兴趣的中国互联网用户`,
    seoAngles: ['2025最新', '性价比', '避坑指南'],
  };
}
