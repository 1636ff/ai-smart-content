#!/usr/bin/env node
/**
 * 关键词研究模块入口
 * 用法: npm run keyword:find -- --niche=数码 --count=30
 */

import { findOpportunities } from './opportunity-finder.js';
import { getDb } from '../database.js';

async function main() {
  const args = process.argv.slice(2);
  const nicheArg = args.find(a => a.startsWith('--niche='));
  const countArg = args.find(a => a.startsWith('--count='));
  const niche = nicheArg?.split('=')[1];
  const count = countArg ? parseInt(countArg.split('=')[1]) : 30;

  console.log('🤖 AI 关键词金矿发现器');
  console.log('======================\n');

  const opportunities = await findOpportunities({
    maxKeywords: count,
    minProfitPotential: 30,
    maxDifficulty: 75,
    niches: niche ? [niche] : undefined,
  });

  console.log('\n📊 统计摘要:');
  console.log(`   发现机会: ${opportunities.length} 个`);
  console.log(`   平均盈利潜力: ${average(opportunities.map(o => o.profitPotential)).toFixed(1)}%`);
  console.log(`   平均难度: ${average(opportunities.map(o => o.difficultyScore)).toFixed(1)}`);
  console.log(`   平均CPC: ¥${average(opportunities.map(o => o.cpcEstimate)).toFixed(2)}`);

  const lowHanging = opportunities.filter(o => o.difficultyScore < 30 && o.profitPotential > 60);
  console.log(`\n🍒 低垂果实 (难度<30 + 盈利>60): ${lowHanging.length} 个`);
  lowHanging.forEach(o => console.log(`   - ${o.keyword} (难度:${o.difficultyScore}, 盈利:${o.profitPotential}%)`));

  // 打印下一步操作建议
  console.log('\n📝 下一步:');
  console.log('   npm run content:generate -- --keyword="关键词"');
  console.log('   npm run pipeline  # 运行全自动流水线');

  const db = getDb();
  const count_ = db.prepare('SELECT COUNT(*) as c FROM keywords').get() as any;
  console.log(`\n💾 数据库中共 ${count_.c} 个关键词`);
}

function average(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
}

main().catch(console.error);
