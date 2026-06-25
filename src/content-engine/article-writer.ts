/**
 * AI文章生成器
 * 将大纲转化为完整的高质量文章，包含SEO优化和联盟链接
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { ArticleOutline, OutlineSection } from './outline-generator.js';

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

export interface GeneratedArticle {
  title: string;
  slug: string;
  metaDescription: string;
  content: string;          // Markdown格式
  htmlContent: string;      // HTML格式
  wordCount: number;
  keyword: string;
  keywordDensity: number;
  affiliateLinks: AffiliateLink[];
  seoScore: number;
  readabilityScore: number;
  publishDate: string;
}

interface AffiliateLink {
  text: string;
  url: string;
  type: 'jd' | 'amazon' | 'other';
  section: string;
}

/**
 * 生成完整文章
 */
export async function generateArticle(
  outline: ArticleOutline,
  keyword: string,
): Promise<GeneratedArticle> {
  console.log(`  ✍️  生成文章: "${outline.title}"`);

  const anthClient = getClient();

  let content: string;
  if (anthClient) {
    content = await generateWithAI(anthClient, outline, keyword);
  } else {
    content = generateTemplateContent(outline, keyword);
  }

  const wordCount = content.length; // 中文字符数约等于字数
  const affiliateLinks = extractAffiliateOpportunities(outline);
  const slug = generateSlug(outline.title, keyword);

  return {
    title: outline.title,
    slug,
    metaDescription: outline.metaDescription,
    content,
    htmlContent: markdownToHtml(content),
    wordCount,
    keyword,
    keywordDensity: calculateKeywordDensity(content, keyword),
    affiliateLinks,
    seoScore: calculateSEOScore(content, outline),
    readabilityScore: calculateReadability(content),
    publishDate: new Date().toISOString().split('T')[0],
  };
}

async function generateWithAI(
  client: Anthropic,
  outline: ArticleOutline,
  keyword: string,
): Promise<string> {
  const sectionsPrompt = outline.sections.map((s, i) =>
    `[段落${i + 1}] ${s.heading} (${s.level})
    要点: ${s.keyPoints.join('、')}
    建议字数: ~${s.suggestedWordCount}字
    是否可插入联盟链接: ${s.affiliateOpportunity ? '是，请自然地推荐产品并标注[affiliate]' : '否'}`
  ).join('\n\n');

  const prompt = `你是一位专业的中文内容创作者和SEO专家。请根据以下大纲写一篇完整的博客文章。

## 文章信息
- 目标关键词: "${keyword}"
- 文章标题: "${outline.title}"
- Meta描述: "${outline.metaDescription}"
- 目标读者: ${outline.targetAudience}
- SEO角度: ${outline.seoAngles.join('、')}

## 文章大纲
${sectionsPrompt}

## 写作要求
1. 使用Markdown格式
2. 语言自然流畅，像真人写的一样，不要感觉像AI
3. 适当使用加粗、列表、引用等格式
4. 关键词自然融入，不要堆砌（密度1-3%）
5. 包含具体数据、案例、个人经验口吻
6. 可以适当加入emoji增加亲和力
7. 联盟链接处用 [affiliate:产品名] 标记
8. 开头要吸引人，结尾要有明确的行动号召
9. 每个段落要有实质性内容，不要水字数
10. 标题要有层次感，H2/H3合理分布

请直接输出完整的Markdown格式文章，不要额外解释。`;

  const response = await client.messages.create({
    model: 'deepseek-v4-pro',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map(block => block.text)
    .join('');
  return text || generateTemplateContent(outline, keyword);
}

function generateTemplateContent(outline: ArticleOutline, keyword: string): string {
  const lines: string[] = [];

  lines.push(`# ${outline.h1}\n`);
  lines.push(`> ${outline.metaDescription}\n`);

  for (const section of outline.sections) {
    const prefix = section.level === 'h2' ? '##' : '###';
    lines.push(`${prefix} ${section.heading}\n`);

    for (const point of section.keyPoints) {
      lines.push(`${point}\n`);
    }

    if (section.affiliateOpportunity) {
      lines.push(`\n> 💡 **推荐**: [affiliate:${keyword.replace('推荐', '').replace('评测', '')}相关产品]\n`);
    }

    lines.push('');
  }

  lines.push('---\n');
  lines.push(`*本文由AI智能内容引擎自动生成并发布。最后更新时间：${new Date().toLocaleDateString('zh-CN')}*\n`);

  return lines.join('\n');
}

function extractAffiliateOpportunities(outline: ArticleOutline): AffiliateLink[] {
  return outline.sections
    .filter(s => s.affiliateOpportunity)
    .map(s => ({
      text: s.heading,
      url: '', // 将由联盟链接器填充
      type: 'other' as const,
      section: s.heading,
    }));
}

function generateSlug(title: string, keyword?: string): string {
  // English-only slug for URL compatibility (Vercel can't serve Chinese paths)
  const ts = Date.now().toString(36);
  // Generate a short English-readable slug from the keyword
  const keywordMap: Record<string, string> = {
    '手机推荐': 'best-phones', '笔记本推荐': 'best-laptops', '耳机评测': 'earphone-review',
    '平板电脑': 'best-tablets', '智能手表': 'best-smartwatches', '相机推荐': 'best-cameras',
    '显示器推荐': 'best-monitors', '机械键盘': 'mechanical-keyboard', '鼠标推荐': 'best-mouse',
    '路由器推荐': 'best-routers', '空气净化器': 'air-purifier', '扫地机器人': 'robot-vacuum',
    '信用卡推荐': 'best-credit-cards', '理财入门': 'finance-guide', '减肥方法': 'weight-loss',
    '英语学习': 'learn-english', '编程入门': 'coding-guide', '基金定投': 'fund-investment',
  };
  const engKeyword = keyword && keywordMap[keyword] ? keywordMap[keyword] : 'article';
  return `${engKeyword}-${ts}`;
}

function calculateKeywordDensity(content: string, keyword: string): number {
  const totalChars = content.length;
  const keywordCount = (content.match(new RegExp(keyword, 'g')) || []).length;
  return totalChars > 0 ? (keywordCount * keyword.length / totalChars) * 100 : 0;
}

function calculateSEOScore(content: string, outline: ArticleOutline): number {
  let score = 50;

  // 标题检查
  if (content.includes(outline.title)) score += 10;
  // 长度检查
  if (content.length > 2000) score += 10;
  if (content.length > 4000) score += 5;
  // H2/H3分布
  const h2Count = (content.match(/^## /gm) || []).length;
  if (h2Count >= 4) score += 10;
  // 有列表
  if (content.includes('- ') || content.includes('1. ')) score += 5;
  // 有引用
  if (content.includes('> ')) score += 5;

  return Math.min(100, score);
}

function calculateReadability(content: string): number {
  // 简单的可读性评估
  const paragraphs = content.split('\n\n');
  const avgParagraphLength = paragraphs.reduce((sum, p) => sum + p.length, 0) / Math.max(paragraphs.length, 1);
  // 理想段落长度 200-400 字符
  return avgParagraphLength < 400 ? 85 : avgParagraphLength < 600 ? 70 : 55;
}

function markdownToHtml(markdown: string): string {
  // 简单的Markdown->HTML转换 (生产环境应使用marked库)
  let html = markdown
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\[affiliate:(.*?)\]/g, '<span class="affiliate-link" data-product="$1">🔗 $1</span>');

  return `<article><p>${html}</p></article>`;
}
