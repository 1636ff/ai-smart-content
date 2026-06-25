#!/usr/bin/env node
/**
 * 内容生成引擎入口
 * 用法: npm run content:generate -- --keyword="手机推荐" --type=review
 */

import { generateOutline } from './outline-generator.js';
import { generateArticle } from './article-writer.js';
import { getDb } from '../database.js';

async function main() {
  const args = process.argv.slice(2);
  const keywordArg = args.find(a => a.startsWith('--keyword='));
  const typeArg = args.find(a => a.startsWith('--type='));
  const keyword = keywordArg?.split('=')[1] || '手机推荐';
  const contentType = (typeArg?.split('=')[1] || 'review') as 'review' | 'guide' | 'comparison' | 'listicle';

  console.log('🤖 AI 内容生成引擎');
  console.log('==================\n');

  // 1. 生成大纲
  console.log('📋 第1步：生成文章大纲...');
  const outline = await generateOutline(keyword, { contentType });

  console.log(`   标题: ${outline.title}`);
  console.log(`   章节: ${outline.sections.length} 个`);
  console.log(`   预估字数: ${outline.estimatedWordCount}`);

  // 2. 生成文章
  console.log('\n✍️  第2步：AI写作中...');
  const article = await generateArticle(outline, keyword);

  console.log(`   实际字数: ${article.wordCount}`);
  console.log(`   SEO评分: ${article.seoScore}/100`);
  console.log(`   可读性: ${article.readabilityScore}/100`);
  console.log(`   关键词密度: ${article.keywordDensity.toFixed(2)}%`);

  // 3. 保存到数据库
  console.log('\n💾 第3步：保存文章...');
  const db = getDb();

  // 先确保关键词存在
  db.prepare(`
    INSERT OR IGNORE INTO keywords (keyword, status, source)
    VALUES (?, 'content_generated', 'content-engine')
  `).run(keyword);

  const keywordRow = db.prepare('SELECT id FROM keywords WHERE keyword = ?').get(keyword) as any;

  db.prepare(`
    INSERT INTO articles (keyword_id, title, slug, outline, content, seo_score, word_count, affiliate_links, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')
  `).run(
    keywordRow?.id || 1,
    article.title,
    article.slug,
    JSON.stringify(outline),
    article.content,
    article.seoScore,
    article.wordCount,
    JSON.stringify(article.affiliateLinks)
  );

  console.log('   ✅ 文章已保存到数据库');

  // 4. 预览
  console.log('\n📖 文章预览（前500字）:');
  console.log('─'.repeat(60));
  console.log(article.content.slice(0, 500) + '...');
  console.log('─'.repeat(60));

  console.log('\n📝 下一步:');
  console.log('   npm run publish  # 发布文章到网站');
  console.log('   npm run pipeline # 运行完整自动化流水线');
}

main().catch(console.error);
