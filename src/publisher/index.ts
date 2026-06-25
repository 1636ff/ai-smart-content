#!/usr/bin/env node
/**
 * 发布系统入口
 * 用法: npm run publish
 */

import { generateSite } from './site-generator.js';
import { deploy, previewLocally } from './deployer.js';
import { getDb } from '../database.js';

async function main() {
  const args = process.argv.slice(2);
  const skipDeploy = args.includes('--skip-deploy');
  const preview = args.includes('--preview');

  console.log('🚀 AI 自动发布系统');
  console.log('==================\n');

  // 1. 生成网站
  const { pages, siteDir } = await generateSite();

  if (pages.length === 0) {
    console.log('没有可发布的文章，请先生成内容。');
    return;
  }

  // 2. 本地预览
  if (preview) {
    await previewLocally(siteDir);
    return;
  }

  // 3. 标记文章为已发布
  const db = getDb();
  const updateStmt = db.prepare(`
    UPDATE articles SET status = 'published', published_at = CURRENT_TIMESTAMP
    WHERE status = 'ready'
  `);
  updateStmt.run();
  console.log('   ✅ 文章状态已更新为"已发布"');

  // 4. 部署
  if (!skipDeploy) {
    const result = await deploy(siteDir);
    if (result.success && result.url) {
      console.log(`\n🎉 网站已上线: ${result.url}`);
    }
  } else {
    console.log(`\n📁 网站已生成在: ${siteDir}`);
    console.log('💡 跳过了部署步骤（--skip-deploy）');
    console.log('💡 部署命令: npm run publish');
  }

  console.log('\n📊 下一步:');
  console.log('   npm run dashboard  # 查看数据仪表盘');
}

main().catch(console.error);
