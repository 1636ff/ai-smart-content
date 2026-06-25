/**
 * 竞争度分析器
 * 评估关键词的排名难度和盈利潜力
 */

export interface CompetitionData {
  keyword: string;
  difficultyScore: number;     // 0-100, 越低越容易排名
  competitionLevel: 'low' | 'medium' | 'high';
  competitorCount: number;
  topDomains: string[];
  avgWordCount: number;
  avgBacklinks: number;
  contentGapScore: number;     // 内容缺口分数, 越高代表越有机会
  cpcEstimate: number;         // 预估CPC (人民币)
  profitPotential: number;     // 综合盈利潜力 0-100
}

/**
 * 通过搜索引擎结果分析竞争度
 */
export async function analyzeCompetition(keyword: string): Promise<CompetitionData> {
  console.log(`  📊 分析竞争度: "${keyword}"`);

  try {
    const searchResults = await fetchSearchResults(keyword);
    const competitors = extractCompetitors(searchResults);
    const stats = calculateStats(competitors);

    const difficultyScore = calculateDifficulty(keyword, stats);
    const contentGapScore = calculateContentGap(stats);
    const cpcEstimate = estimateCPC(keyword);
    const profitPotential = calculateProfitPotential(difficultyScore, contentGapScore, cpcEstimate);

    return {
      keyword,
      difficultyScore,
      competitionLevel: difficultyScore < 30 ? 'low' : difficultyScore < 60 ? 'medium' : 'high',
      competitorCount: competitors.length,
      topDomains: competitors.map(c => c.domain).slice(0, 5),
      avgWordCount: stats.avgWordCount,
      avgBacklinks: stats.avgBacklinks,
      contentGapScore,
      cpcEstimate,
      profitPotential,
    };
  } catch (error) {
    console.warn(`  ⚠️ 竞争度分析失败: "${keyword}", 使用估计值`);
    return estimateCompetition(keyword);
  }
}

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  domain: string;
}

interface CompetitorStats {
  avgWordCount: number;
  avgBacklinks: number;
  hasForums: boolean;
  hasSmallSites: boolean;
  domainAuthorityRange: { min: number; max: number };
}

async function fetchSearchResults(keyword: string): Promise<SearchResult[]> {
  // 免费方案：使用 DuckDuckGo Instant Answer API (无需API Key)
  const query = encodeURIComponent(keyword);
  const url = `https://api.duckduckgo.com/?q=${query}&format=json&no_html=1`;

  try {
    const response = await fetch(url);
    const data = await response.json() as any;

    const results: SearchResult[] = [];
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, 10)) {
        if (topic.FirstURL && topic.Text) {
          const domain = new URL(topic.FirstURL).hostname;
          results.push({
            title: topic.Text,
            link: topic.FirstURL,
            snippet: topic.Text,
            domain,
          });
        }
      }
    }
    return results;
  } catch {
    return [];
  }
}

function extractCompetitors(results: SearchResult[]): SearchResult[] {
  return results.filter(r => {
    // 过滤掉大型平台（它们不是直接竞争对手）
    const bigPlatforms = ['zhihu.com', 'baidu.com', 'wikipedia.org', 'jd.com', 'tmall.com'];
    const isBig = bigPlatforms.some(p => r.domain.includes(p));
    return !isBig;
  });
}

function calculateStats(competitors: SearchResult[]): CompetitorStats {
  // 基于可获取的信号估算
  const hasForums = competitors.some(c =>
    c.domain.includes('zhihu') || c.domain.includes('tieba') || c.domain.includes('douban')
  );
  const hasSmallSites = competitors.some(c =>
    !['zhihu.com', 'baidu.com'].some(b => c.domain.includes(b))
  );

  // 估算词数 (基于snippet长度推测)
  const avgSnippetLength = competitors.reduce((sum, c) => sum + c.snippet.length, 0) / Math.max(competitors.length, 1);

  return {
    avgWordCount: Math.max(500, Math.floor(avgSnippetLength * 10)),
    avgBacklinks: hasForums ? 5 : 20,
    hasForums,
    hasSmallSites,
    domainAuthorityRange: hasSmallSites ? { min: 10, max: 40 } : { min: 40, max: 80 },
  };
}

function calculateDifficulty(keyword: string, stats: CompetitorStats): number {
  let score = 0;

  // 关键词长度越长，通常越容易排名
  const wordCount = keyword.length;
  if (wordCount > 10) score -= 15;
  else if (wordCount > 6) score -= 5;
  else score += 10;

  // 有论坛结果代表低质量内容可排名
  if (stats.hasForums) score -= 20;
  if (stats.hasSmallSites) score -= 10;

  // 高DA站点多则困难
  if (stats.domainAuthorityRange.min > 50) score += 20;

  return Math.max(5, Math.min(95, score + 30));
}

function calculateContentGap(stats: CompetitorStats): number {
  let score = 50;
  // 平均词数低 = 内容浅 = 机会大
  if (stats.avgWordCount < 1000) score += 25;
  else if (stats.avgWordCount > 3000) score -= 15;
  // 有小站点 = 内容质量参差不齐 = 机会大
  if (stats.hasSmallSites) score += 15;
  return Math.max(0, Math.min(100, score));
}

function estimateCPC(keyword: string): number {
  // 基于关键词类型估算CPC (人民币)
  const highCPC = ['保险', '贷款', '信用卡', '理财', '基金', '股票', '房产', '律师', '留学', '移民'];
  const mediumCPC = ['手机', '电脑', '相机', '家电', '家具', '课程', '培训', '装修', '医美', '牙科'];
  const lowCPC = ['食谱', '手工', '旅游', '游戏', '电影', '音乐', '宠物', '花卉', '运动'];

  const kw = keyword.toLowerCase();
  if (highCPC.some(w => kw.includes(w))) return 50 + Math.random() * 100;
  if (mediumCPC.some(w => kw.includes(w))) return 10 + Math.random() * 30;
  if (lowCPC.some(w => kw.includes(w))) return 1 + Math.random() * 5;
  return 3 + Math.random() * 10;
}

function calculateProfitPotential(
  difficulty: number,
  contentGap: number,
  cpc: number
): number {
  // 盈利潜力 = 低难度 * 高内容缺口 * 高CPC
  const difficultyFactor = (100 - difficulty) / 100;
  const gapFactor = contentGap / 100;
  const cpcFactor = Math.min(1, cpc / 50);

  return Math.round((difficultyFactor * 0.4 + gapFactor * 0.3 + cpcFactor * 0.3) * 100);
}

function estimateCompetition(keyword: string): CompetitionData {
  return {
    keyword,
    difficultyScore: 40 + Math.random() * 20,
    competitionLevel: 'medium',
    competitorCount: 10,
    topDomains: [],
    avgWordCount: 1500,
    avgBacklinks: 15,
    contentGapScore: 60,
    cpcEstimate: estimateCPC(keyword),
    profitPotential: 50 + Math.random() * 20,
  };
}
