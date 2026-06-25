/**
 * Google Trends 数据抓取器
 * 自动发现热门话题和上升趋势
 */

interface TrendResult {
  keyword: string;
  volume: number;
  trend: 'rising' | 'stable' | 'declining';
  related: string[];
}

const TRENDS_CACHE = new Map<string, { data: TrendResult[]; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1小时

/**
 * 从RSS源和公开API获取趋势数据
 * 使用Google Trends的非官方API
 */
export async function fetchTrendingTopics(
  category: string = 'all',
  region: string = 'CN'
): Promise<TrendResult[]> {
  const cacheKey = `${category}:${region}`;
  const cached = TRENDS_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    // 使用Google Trends Daily Trends RSS
    const url = `https://trends.google.com/trending/rss?geo=${region}`;
    const response = await fetch(url);
    const text = await response.text();

    const results: TrendResult[] = [];
    const itemRegex = /<title>(.*?)<\/title>[\s\S]*?<ht:approx_traffic>(.*?)<\/ht:approx_traffic>/g;
    let match;

    while ((match = itemRegex.exec(text)) !== null) {
      const keyword = match[1].trim();
      const volume = parseInt(match[2].replace(/[,+]/g, '')) || 1000;
      if (keyword && keyword !== 'Daily Search Trends') {
        results.push({
          keyword,
          volume,
          trend: 'rising',
          related: [],
        });
      }
    }

    TRENDS_CACHE.set(cacheKey, { data: results, timestamp: Date.now() });
    return results;
  } catch (error) {
    console.warn('Google Trends fetch failed, using fallback data:', error);
    return getFallbackTrends();
  }
}

/**
 * 基于当前热点生成种子关键词
 * 覆盖高价值领域
 */
export function getSeedKeywords(): string[] {
  return [
    // 数码产品 (高CPC)
    '手机推荐', '笔记本推荐', '耳机评测', '平板电脑', '智能手表',
    '相机推荐', '显示器推荐', '机械键盘', '鼠标推荐', '路由器推荐',
    // 家居生活 (持续流量)
    '空气净化器', '扫地机器人', '空调推荐', '洗衣机推荐', '冰箱推荐',
    '床垫推荐', '人体工学椅', '投影仪推荐', '加湿器推荐', '除湿机',
    // 金融理财 (最高CPC)
    '信用卡推荐', '理财产品', '基金定投', '股票开户', '保险推荐',
    '贷款攻略', '征信修复', '税务筹划', '公积金贷款', '房贷计算',
    // 健康养生 (大流量)
    '减肥方法', '健身计划', '瑜伽入门', '生酮饮食', '保健品推荐',
    '视力保护', '颈椎康复', '失眠治疗', '中医养生', '营养搭配',
    // 教育学习 (持续需求)
    '英语学习', '编程入门', '考研资料', '公务员考试', '雅思备考',
    '钢琴教学', '摄影教程', '插画入门', '视频剪辑', 'AI工具',
    // 母婴育儿 (高转化)
    '奶粉推荐', '婴儿车推荐', '安全座椅', '早教机推荐', '纸尿裤评测',
    '待产包清单', '月子餐食谱', '宝宝辅食', '儿童玩具', '绘本推荐',
  ];
}

function getFallbackTrends(): TrendResult[] {
  const seeds = getSeedKeywords();
  return seeds.slice(0, 20).map(k => ({
    keyword: k,
    volume: Math.floor(Math.random() * 100000) + 1000,
    trend: 'stable' as const,
    related: [],
  }));
}
