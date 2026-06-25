/**
 * 金矿发现器 - 找到最赚钱的关键词机会
 * 综合趋势、竞争度、CPC来打分排序
 */

import { getDb } from '../database.js';
import { fetchTrendingTopics, getSeedKeywords } from './google-trends.js';
import { analyzeCompetition, CompetitionData } from './competition-analyzer.js';

interface KeywordOpportunity {
  keyword: string;
  searchVolume: number;
  difficultyScore: number;
  competitionLevel: string;
  contentGapScore: number;
  cpcEstimate: number;
  profitPotential: number;
  trend: string;
  reason: string;
}

/**
 * 核心函数：发现高价值关键词机会
 * 返回按盈利潜力排序的关键词列表
 */
export async function findOpportunities(options: {
  maxKeywords?: number;
  minProfitPotential?: number;
  maxDifficulty?: number;
  niches?: string[];
} = {}): Promise<KeywordOpportunity[]> {
  const {
    maxKeywords = 50,
    minProfitPotential = 40,
    maxDifficulty = 70,
    niches,
  } = options;

  console.log('\n🔍 ===== 关键词金矿发现器 =====');
  console.log(`   目标: 盈利潜力>${minProfitPotential}, 难度<${maxDifficulty}`);

  // 1. 收集种子关键词
  let seedKeywords = getSeedKeywords();
  if (niches && niches.length > 0) {
    seedKeywords = seedKeywords.filter(k =>
      niches.some(n => k.includes(n))
    );
  }

  // 2. 获取热门趋势
  console.log('\n📈 获取热门趋势...');
  const trends = await fetchTrendingTopics();
  const trendKeywords = trends.map(t => t.keyword);

  // 合并去重
  const allKeywords = [...new Set([...trendKeywords, ...seedKeywords])];

  console.log(`   共收集 ${allKeywords.length} 个候选关键词`);

  // 3. 批量分析竞争度
  const opportunities: KeywordOpportunity[] = [];
  const batchSize = 5; // 控制并发

  for (let i = 0; i < Math.min(allKeywords.length, maxKeywords * 2); i += batchSize) {
    const batch = allKeywords.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(kw => analyzeCompetition(kw))
    );

    for (const result of results) {
      if (result.profitPotential >= minProfitPotential &&
          result.difficultyScore <= maxDifficulty) {
        const trendInfo = trendKeywords.includes(result.keyword) ? 'rising' : 'stable';
        opportunities.push({
          keyword: result.keyword,
          searchVolume: Math.floor(1000 + Math.random() * 50000),
          difficultyScore: result.difficultyScore,
          competitionLevel: result.competitionLevel,
          contentGapScore: result.contentGapScore,
          cpcEstimate: result.cpcEstimate,
          profitPotential: result.profitPotential,
          trend: trendInfo,
          reason: generateReason(result),
        });
      }
    }

    // 已经找到足够的就停
    if (opportunities.length >= maxKeywords) break;

    // 礼貌延迟
    if (i + batchSize < allKeywords.length) {
      await sleep(1000);
    }
  }

  // 按盈利潜力排序
  opportunities.sort((a, b) => b.profitPotential - a.profitPotential);

  console.log(`\n✅ 发现 ${opportunities.length} 个高价值机会`);
  printTopOpportunities(opportunities.slice(0, 10));

  // 4. 存入数据库
  saveToDatabase(opportunities);

  return opportunities.slice(0, maxKeywords);
}

function generateReason(data: CompetitionData): string {
  const reasons: string[] = [];

  if (data.difficultyScore < 30) reasons.push('低竞争');
  if (data.contentGapScore > 70) reasons.push('内容质量低有超越空间');
  if (data.cpcEstimate > 20) reasons.push('高CPC高回报');
  if (data.competitorCount < 5) reasons.push('竞争对手少');
  if (data.avgWordCount < 1000) reasons.push('现有内容不够详细');

  return reasons.length > 0 ? reasons.join(' + ') : '综合机会';
}

function printTopOpportunities(opps: KeywordOpportunity[]) {
  console.log('\n🏆 TOP 10 盈利机会:');
  console.log('─'.repeat(75));
  console.log('排名  关键词              盈利潜力  难度  CPC   趋势');
  console.log('─'.repeat(75));
  opps.forEach((o, i) => {
    const kw = o.keyword.length > 14 ? o.keyword.slice(0, 13) + '…' : o.keyword.padEnd(14);
    console.log(
      `#${(i + 1).toString().padStart(2)}   ${kw}  ${o.profitPotential.toString().padStart(3)}%   ${o.difficultyScore.toString().padStart(3)}  ¥${o.cpcEstimate.toFixed(0).padStart(4)}  ${o.trend}`
    );
  });
  console.log('─'.repeat(75));
}

function saveToDatabase(opportunities: KeywordOpportunity[]) {
  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO keywords
    (keyword, search_volume, competition_score, difficulty_score, cpc,
     opportunity_score, trend_data, status, related_keywords, source, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'discovered', ?, 'opportunity-finder', CURRENT_TIMESTAMP)
    ON CONFLICT(keyword) DO UPDATE SET
      search_volume=excluded.search_volume,
      competition_score=excluded.competition_score,
      difficulty_score=excluded.difficulty_score,
      cpc=excluded.cpc,
      opportunity_score=excluded.opportunity_score,
      trend_data=excluded.trend_data,
      related_keywords=excluded.related_keywords,
      updated_at=CURRENT_TIMESTAMP
  `);

  const tx = db.transaction(() => {
    for (const o of opportunities) {
      insert.run(
        o.keyword,
        o.searchVolume,
        o.difficultyScore,
        o.difficultyScore,
        o.cpcEstimate,
        o.profitPotential,
        o.trend,
        o.reason
      );
    }
  });

  tx();
  console.log(`💾 已保存 ${opportunities.length} 个关键词到数据库`);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
