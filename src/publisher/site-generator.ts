/**
 * 静态网站生成器
 * 将数据库中的文章生成完整的静态HTML网站
 */

import { getDb } from '../database.js';
import { config } from '../config.js';
import fs from 'fs';
import path from 'path';

interface SitePage {
  path: string;
  html: string;
  title: string;
  description: string;
}

/**
 * 生成完整网站
 */
export async function generateSite(): Promise<{ pages: SitePage[]; siteDir: string }> {
  console.log('\n🏗️  ===== 网站生成器 =====');

  const db = getDb();
  const articles = db.prepare(`
    SELECT a.*, k.keyword, k.search_volume
    FROM articles a
    LEFT JOIN keywords k ON a.keyword_id = k.id
    WHERE a.status IN ('draft', 'ready', 'published')
    ORDER BY a.created_at DESC
  `).all() as any[];

  if (articles.length === 0) {
    console.log('   ⚠️ 没有待发布的文章，先生成内容吧');
    return { pages: [], siteDir: '' };
  }

  const siteDir = path.join(process.cwd(), 'sites', sanitize(config.site.name));
  fs.mkdirSync(siteDir, { recursive: true });
  fs.mkdirSync(path.join(siteDir, 'articles'), { recursive: true });
  fs.mkdirSync(path.join(siteDir, 'css'), { recursive: true });

  const pages: SitePage[] = [];

  // 生成首页
  console.log('   📄 生成首页...');
  const homePage = generateHomePage(articles);
  pages.push(homePage);
  fs.writeFileSync(path.join(siteDir, 'index.html'), homePage.html);

  // 生成文章页
  console.log(`   📝 生成 ${articles.length} 篇文章页...`);
  for (const article of articles) {
    const articlePage = generateArticlePage(article, articles);
    pages.push(articlePage);

    const articleDir = path.join(siteDir, 'articles', article.slug);
    fs.mkdirSync(articleDir, { recursive: true });
    fs.writeFileSync(path.join(articleDir, 'index.html'), articlePage.html);
  }

  // 生成CSS
  generateCSS(siteDir);

  // 生成sitemap
  generateSitemap(siteDir, pages);
  console.log('   🗺️  生成 sitemap.xml');

  // 生成RSS
  generateRSS(siteDir, articles);
  console.log('   📡 生成 RSS feed');

  // 生成robots.txt
  generateRobots(siteDir);
  console.log('   🤖 生成 robots.txt');

  // 生成ads.txt
  if (config.adsense.enabled) {
    generateAdsTxt(siteDir);
    console.log('   💰 生成 ads.txt');
  }

  console.log(`\n✅ 网站已生成: ${siteDir}`);
  console.log(`   总页数: ${pages.length}`);

  return { pages, siteDir };
}

function generateHomePage(articles: any[]): SitePage {
  const recentArticles = articles.slice(0, 12);

  const articleCards = recentArticles.map((a, i) => `
    <article class="card" style="animation-delay: ${i * 0.1}s">
      <div class="card-badge">${a.search_volume ? `🔥 ${a.search_volume.toLocaleString()} 搜索` : '📝 新文章'}</div>
      <h2><a href="/articles/${a.slug}/">${a.title}</a></h2>
      <p class="card-excerpt">${(a.content || '').replace(/[#*\[\]]/g, '').slice(0, 150)}...</p>
      <div class="card-meta">
        <span>📅 ${a.published_at || a.created_at}</span>
        <span>📊 SEO ${a.seo_score || 0}分</span>
        <span>📝 ${a.word_count || 0}字</span>
      </div>
      <a href="/articles/${a.slug}/" class="btn-read">阅读全文 →</a>
    </article>
  `).join('\n');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.site.name} - ${config.site.description}</title>
  <meta name="description" content="${config.site.description}">
  <link rel="stylesheet" href="/css/style.css">
  ${config.adsense.enabled ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.adsense.publisherId}" crossorigin="anonymous"></script>` : ''}
</head>
<body>
  <header class="site-header">
    <div class="container">
      <a href="/" class="logo">${config.site.name}</a>
      <nav>
        <a href="/">首页</a>
        <a href="#articles">文章</a>
        <a href="#about">关于</a>
      </nav>
    </div>
  </header>

  <section class="hero">
    <div class="container">
      <h1>${config.site.description}</h1>
      <p>人工智能驱动的优质内容，帮你做出最明智的选择 🚀</p>
      <div class="hero-stats">
        <div class="stat"><span class="stat-num">${articles.length}</span><span>篇文章</span></div>
        <div class="stat"><span class="stat-num">${articles.reduce((s: number, a: any) => s + (a.word_count || 0), 0).toLocaleString()}</span><span>总字数</span></div>
        <div class="stat"><span class="stat-num">每日更新</span><span>持续输出</span></div>
      </div>
    </div>
  </section>

  <main class="container" id="articles">
    <h2 class="section-title">📚 最新文章</h2>
    <div class="card-grid">
      ${articleCards}
    </div>
  </main>

  <footer class="site-footer">
    <div class="container">
      <p>© ${new Date().getFullYear()} ${config.site.name} | AI驱动的内容平台</p>
      <p><a href="/sitemap.xml">Sitemap</a> | <a href="/rss.xml">RSS</a></p>
    </div>
  </footer>
</body>
</html>`;

  return { path: '/', html, title: config.site.name, description: config.site.description };
}

function generateArticlePage(article: any, allArticles?: any[]): SitePage {
  const rawContent = article.content || '';
  // Generate HTML from markdown
  const bodyHtml = rawContent
    .replace(/^### (.*$)/gm, '<h3 id="$1">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 id="$1">$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/\[affiliate:(.*?)\]/g, generateAffiliateHtml('$1'));

  // Extract headings for table of contents
  const headings: { text: string; level: 'h2'|'h3' }[] = [];
  const headingRegex = /^## (.*$)/gm;
  const subHeadingRegex = /^### (.*$)/gm;
  let match;
  while ((match = headingRegex.exec(rawContent)) !== null) {
    headings.push({ text: match[1], level: 'h2' });
  }
  while ((match = subHeadingRegex.exec(rawContent)) !== null) {
    headings.push({ text: match[1], level: 'h3' });
  }

  const tocHtml = headings.length > 2 ? `
  <nav class="toc">
    <div class="toc-title">📑 目录</div>
    <ul class="toc-list">
      ${headings.map(h => `<li><a href="#${h.text}" class="${h.level === 'h3' ? 'toc-h3' : ''}">${h.text}</a></li>`).join('')}
    </ul>
  </nav>` : '';

  // Reading time
  const wordCount = article.word_count || rawContent.length;
  const readTime = Math.max(1, Math.round(wordCount / 400)); // 400 chars/min

  // Related articles (different from current)
  const related = (allArticles || [])
    .filter((a: any) => a.id !== article.id)
    .slice(0, 4);

  const relatedHtml = related.length > 0 ? `
  <section class="related-section">
    <h2 class="section-title">📖 相关推荐</h2>
    <div class="related-grid">
      ${related.map((r: any) => `
        <div class="related-card">
          <a href="/articles/${r.slug}/">${r.title}</a>
          <div style="font-size:0.8em;color:var(--text-muted);margin-top:6px;">📝 ${r.word_count || 0}字 · 📊 SEO ${r.seo_score || 0}</div>
        </div>
      `).join('')}
    </div>
  </section>` : '';

  const adCode = config.adsense.enabled ? `
    <div class="ad-container">
      <ins class="adsbygoogle"
        style="display:block; text-align:center;"
        data-ad-client="${config.adsense.publisherId}"
        data-ad-slot="auto"
        data-ad-format="auto"
        data-full-width-responsive="true"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </div>` : '';

  const currentUrl = `${config.site.url}/articles/${article.slug}/`;
  const encodedUrl = encodeURIComponent(currentUrl);
  const encodedTitle = encodeURIComponent(article.title || '');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${article.title} - ${config.site.name}</title>
  <meta name="description" content="${rawContent.replace(/[#*\[\]]/g, '').slice(0, 160)}">
  <meta name="keywords" content="${article.keyword || ''}">
  <link rel="stylesheet" href="/css/style.css">
  <link rel="canonical" href="${currentUrl}">
  <meta property="og:title" content="${article.title}">
  <meta property="og:description" content="${rawContent.replace(/[#*\[\]]/g, '').slice(0, 200)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${currentUrl}">
  <meta name="twitter:card" content="summary_large_image">
  ${config.adsense.enabled ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.adsense.publisherId}" crossorigin="anonymous"></script>` : ''}
</head>
<body>
  <div class="progress-bar" id="progressBar"></div>

  <header class="site-header">
    <div class="container">
      <a href="/" class="logo">${config.site.name}</a>
      <nav>
        <a href="/">🏠 首页</a>
        <a href="/#articles">📚 文章</a>
        <a href="/sitemap.xml">🗺️ 站点地图</a>
      </nav>
    </div>
  </header>

  <main class="container article-page">
    <article class="article-content">
      <nav class="breadcrumb">
        <a href="/">首页</a> / <span>${article.keyword || '文章'}</span>
      </nav>

      <header class="article-header">
        <h1>${article.title}</h1>
        <div class="article-meta">
          <span>📅 ${(article.published_at || article.created_at || '').slice(0, 10)}</span>
          <span>📝 ${wordCount.toLocaleString()}字</span>
          <span>⏱️ ${readTime}分钟阅读</span>
          <span>🏷️ ${article.keyword || ''}</span>
          <span>📊 SEO ${article.seo_score || 0}分</span>
        </div>
      </header>

      ${tocHtml}
      ${adCode}

      <div class="article-body">
        <p>${bodyHtml}</p>
      </div>

      ${adCode}

      <div class="share-buttons">
        <span style="color:var(--text-secondary);font-size:0.9em;">🔗 分享：</span>
        <a href="https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}" target="_blank" rel="nofollow noopener" class="share-btn">𝕏 Twitter</a>
        <a href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="nofollow noopener" class="share-btn">📘 Facebook</a>
        <a href="https://service.weibo.com/share/share.php?url=${encodedUrl}&title=${encodedTitle}" target="_blank" rel="nofollow noopener" class="share-btn">💬 微博</a>
      </div>

      <footer class="article-footer">
        <p>📝 本文由AI智能内容引擎自动生成 | 最后更新：${new Date().toLocaleDateString('zh-CN')}</p>
        <p style="font-size:0.82em;margin-top:6px;">内容仅供参考，购买前请多方核实</p>
      </footer>

      ${relatedHtml}
    </article>

    <aside class="article-sidebar">
      <div class="sidebar-widget">
        <h3>🔥 热门推荐</h3>
        <ul>
          ${(allArticles || []).slice(0, 5).map((a: any) =>
            `<li><a href="/articles/${a.slug}/">${a.title}</a><div style="font-size:0.75em;color:var(--text-muted);margin-top:2px;">${(a.word_count||0).toLocaleString()}字 · ⏱️${Math.max(1,Math.round((a.word_count||0)/400))}分钟</div></li>`
          ).join('')}
        </ul>
      </div>
      ${config.adsense.enabled ? `
      <div class="sidebar-widget">
        <ins class="adsbygoogle"
          style="display:block"
          data-ad-client="${config.adsense.publisherId}"
          data-ad-slot="auto"
          data-ad-format="rectangle"></ins>
        <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
      </div>` : ''}
    </aside>
  </main>

  <button class="scroll-top" id="scrollTop" onclick="window.scrollTo({top:0,behavior:'smooth'})" aria-label="回到顶部">↑</button>

  <footer class="site-footer">
    <div class="container">
      <p><strong>${config.site.name}</strong> — ${config.site.description}</p>
      <p>
        <a href="/">首页</a> · <a href="/sitemap.xml">Sitemap</a> · <a href="/rss.xml">RSS</a>
      </p>
      <p style="font-size:0.82em;">© ${new Date().getFullYear()} | AI驱动 · 持续更新</p>
    </div>
  </footer>

  <script>
    // Reading progress bar
    window.addEventListener('scroll', () => {
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = window.scrollY;
      document.getElementById('progressBar').style.width = docH > 0 ? (scrolled/docH*100).toFixed(1) + '%' : '0%';
    });
    // Scroll to top button
    const scrollTop = document.getElementById('scrollTop');
    window.addEventListener('scroll', () => {
      scrollTop.classList.toggle('visible', window.scrollY > 500);
    });
    // Smooth TOC scrolling
    document.querySelectorAll('.toc-list a').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        const target = document.querySelector(a.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  </script>
</body>
</html>`;

  return {
    path: `/articles/${article.slug}/`,
    html,
    title: article.title,
    description: rawContent.replace(/[#*\[\]]/g, '').slice(0, 160),
  };
}

function generateAffiliateHtml(product: string): string {
  // 京东联盟链接
  if (config.jd.enabled) {
    return `<a href="https://union-click.jd.com/jdc?e=&p=JF8BAPQJK1olXwQAVV5cD08WAG4NHF4lXwQAVV5cD08WAG4NHF4lXwQAVV5cD08WAG4NHF4lXwQAVV5cD08WAG4NHF4lXwQAVV5cD08WAG4NHF4lXwQAVV5cD08WAG4NHF4lXwQAVV5cD08WAG4NHF4lXwQAVV5cD08WAG4NHF4lXwQAVV5cD08WAG4NHF4lXwQAVV5cD08WAG4NHF4lXwQAVV5cD08WAG4NHF4lXwQAVV5cD08WAG4NHF4lXwQAVV5cD08WAG4NHF4lXwQAVV5cD08WAG4NHF4lXwQAVV5cD08WAG4NHF4lXwQAVV5cD08WAG4NHF4lXwQAVV5cD08WAG4NHF4l" target="_blank" rel="nofollow sponsored" class="affiliate-link">🔗 ${product}（京东自营）</a>`;
  }
  if (config.amazon.enabled) {
    return `<a href="https://www.amazon.com/s?tag=${config.amazon.trackingId}&k=${encodeURIComponent(product)}" target="_blank" rel="nofollow sponsored" class="affiliate-link">🛒 ${product} (Amazon)</a>`;
  }
  return `<span class="affiliate-placeholder">🔗 ${product}</span>`;
}

function generateCSS(siteDir: string) {
  const css = `/* ✨ AI智能内容引擎 v2 - 现代化设计系统 */
:root {
  --primary: #6366f1;
  --primary-light: #818cf8;
  --primary-dark: #4f46e5;
  --accent: #f59e0b;
  --accent-light: #fbbf24;
  --bg: #f8fafc;
  --card-bg: #ffffff;
  --card-hover: #f1f5f9;
  --text: #1e293b;
  --text-secondary: #64748b;
  --text-muted: #94a3b8;
  --border: #e2e8f0;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow: 0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04);
  --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.04);
  --radius-sm: 8px;
  --radius: 14px;
  --radius-lg: 20px;
  --max-width: 1140px;
  --font-sans: "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, -apple-system, sans-serif;
  --transition: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

/* === Dark Mode === */
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f172a;
    --card-bg: #1e293b;
    --card-hover: #273548;
    --text: #f1f5f9;
    --text-secondary: #94a3b8;
    --text-muted: #64748b;
    --border: #334155;
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
    --shadow: 0 4px 6px -1px rgba(0,0,0,0.4);
    --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.5);
    --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.6);
  }
}

*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

html { scroll-behavior: smooth; }

body {
  font-family: var(--font-sans);
  background: var(--bg);
  color: var(--text);
  line-height: 1.75;
  -webkit-font-smoothing: antialiased;
}

.container { max-width: var(--max-width); margin: 0 auto; padding: 0 24px; }

/* === Reading Progress Bar === */
.progress-bar {
  position: fixed; top: 0; left: 0; height: 3px;
  background: linear-gradient(90deg, var(--primary), var(--accent));
  z-index: 1000; transition: width 0.1s linear;
}

/* === Header === */
.site-header {
  background: rgba(255,255,255,0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border); padding: 14px 0;
  position: sticky; top: 0; z-index: 100;
}
@media (prefers-color-scheme: dark) { .site-header { background: rgba(15,23,42,0.9); } }
.site-header .container { display: flex; justify-content: space-between; align-items: center; }
.logo {
  font-size: 1.35em; font-weight: 800; background: linear-gradient(135deg, var(--primary), #a855f7);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  text-decoration: none; letter-spacing: -0.02em;
}
nav { display: flex; gap: 8px; }
nav a {
  color: var(--text-secondary); text-decoration: none; font-size: 0.92em;
  padding: 6px 14px; border-radius: 8px; transition: var(--transition);
}
nav a:hover { color: var(--primary); background: rgba(99,102,241,0.08); }

/* === Hero === */
.hero {
  background: linear-gradient(135deg, #1e1b4b 0%, #312e81 30%, #4f46e5 60%, #7c3aed 100%);
  color: white; padding: 80px 0 70px; text-align: center; position: relative; overflow: hidden;
}
.hero::before {
  content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
  background: radial-gradient(circle at 30% 50%, rgba(168,85,247,0.15) 0%, transparent 50%),
              radial-gradient(circle at 70% 30%, rgba(99,102,241,0.2) 0%, transparent 50%),
              radial-gradient(circle at 50% 80%, rgba(245,158,11,0.1) 0%, transparent 40%);
  animation: heroGlow 8s ease-in-out infinite alternate;
}
@keyframes heroGlow {
  0% { transform: translate(0, 0) scale(1); }
  100% { transform: translate(1%, 1%) scale(1.02); }
}
.hero .container { position: relative; z-index: 1; }
.hero h1 { font-size: 2.6em; font-weight: 800; margin-bottom: 16px; letter-spacing: -0.03em; }
.hero p { font-size: 1.2em; opacity: 0.85; margin-bottom: 32px; max-width: 600px; margin-left: auto; margin-right: auto; }
.hero-stats { display: flex; justify-content: center; gap: 48px; }
.stat { display: flex; flex-direction: column; }
.stat-num { font-size: 2.4em; font-weight: 800; line-height: 1.1; }
.stat-label { font-size: 0.9em; opacity: 0.7; margin-top: 4px; }

/* === Section Titles === */
.section-title {
  margin: 48px 0 24px; font-size: 1.5em; font-weight: 700;
  display: flex; align-items: center; gap: 10px;
}
.section-title::after {
  content: ''; flex: 1; height: 1px; background: var(--border);
}

/* === Card Grid === */
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 24px; margin-bottom: 48px; }
.card {
  background: var(--card-bg); border-radius: var(--radius);
  border: 1px solid var(--border); overflow: hidden;
  transition: all var(--transition);
  animation: fadeInUp 0.5s ease both;
  display: flex; flex-direction: column;
}
@keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
.card:hover {
  transform: translateY(-4px); box-shadow: var(--shadow-lg);
  border-color: var(--primary-light);
}
.card-body { padding: 24px; flex: 1; display: flex; flex-direction: column; }
.card-badge {
  display: inline-flex; align-items: center; gap: 4px;
  background: linear-gradient(135deg, #fef3c7, #fde68a);
  color: #92400e; padding: 3px 12px; border-radius: 100px; font-size: 0.78em;
  font-weight: 600; margin-bottom: 14px; width: fit-content;
}
.card h2 { font-size: 1.15em; line-height: 1.5; margin-bottom: 10px; }
.card h2 a { color: var(--text); text-decoration: none; transition: color 0.2s; }
.card h2 a:hover { color: var(--primary); }
.card-excerpt {
  color: var(--text-secondary); font-size: 0.88em;
  line-height: 1.6; margin-bottom: 16px; flex: 1;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.card-meta { display: flex; gap: 16px; font-size: 0.8em; color: var(--text-muted); padding-top: 14px; border-top: 1px solid var(--border); }
.btn-read { display: inline-flex; align-items: center; gap: 6px; color: var(--primary); text-decoration: none; font-weight: 600; font-size: 0.88em; margin-top: 12px; transition: gap 0.2s; }
.btn-read:hover { gap: 10px; }
.btn-read::after { content: '→'; transition: transform 0.2s; }
.btn-read:hover::after { transform: translateX(3px); }

/* === Article Page === */
.article-page { display: grid; grid-template-columns: 1fr 320px; gap: 48px; margin-top: 36px; margin-bottom: 60px; }
.article-content { min-width: 0; }

/* Breadcrumb */
.breadcrumb { font-size: 0.85em; color: var(--text-muted); margin-bottom: 20px; }
.breadcrumb a { color: var(--text-secondary); text-decoration: none; }
.breadcrumb a:hover { color: var(--primary); }

/* Article Header */
.article-header { margin-bottom: 32px; }
.article-header h1 { font-size: 2em; line-height: 1.35; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 14px; }
.article-meta { display: flex; flex-wrap: wrap; gap: 18px; color: var(--text-muted); font-size: 0.9em; }
.article-meta span { display: inline-flex; align-items: center; gap: 5px; }

/* Table of Contents */
.toc {
  background: var(--card-bg); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 20px 24px; margin-bottom: 32px;
}
.toc-title { font-size: 0.95em; font-weight: 700; margin-bottom: 12px; color: var(--text); }
.toc-list { list-style: none; }
.toc-list li { margin-bottom: 6px; }
.toc-list a {
  color: var(--text-secondary); text-decoration: none; font-size: 0.88em;
  transition: color 0.2s; display: block; padding: 3px 0;
}
.toc-list a:hover { color: var(--primary); }
.toc-list a.toc-h3 { padding-left: 16px; font-size: 0.83em; }

/* Article Body */
.article-body { font-size: 1.08em; line-height: 1.85; color: var(--text); }
.article-body h2 { margin: 40px 0 18px; font-size: 1.5em; font-weight: 700; color: var(--text); padding-top: 8px; }
.article-body h3 { margin: 28px 0 12px; font-size: 1.2em; font-weight: 600; color: var(--text); }
.article-body p { margin-bottom: 20px; }
.article-body ul, .article-body ol { margin: 12px 0 20px 24px; }
.article-body li { margin-bottom: 8px; }
.article-body blockquote {
  background: linear-gradient(135deg, rgba(99,102,241,0.04), rgba(168,85,247,0.04));
  border-left: 4px solid var(--primary); padding: 18px 24px; margin: 28px 0;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0; font-style: italic;
  color: var(--text-secondary);
}
.article-body strong { color: var(--text); font-weight: 700; }
.article-body img { max-width: 100%; border-radius: var(--radius-sm); margin: 16px 0; }

/* Ad Container */
.ad-container { margin: 36px 0; text-align: center; min-height: 100px; background: var(--card-bg); border: 1px dashed var(--border); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; font-size: 0.85em; color: var(--text-muted); }

/* Affiliate Link */
.affiliate-link {
  display: inline-flex; align-items: center; gap: 6px;
  background: linear-gradient(135deg, #f59e0b, #ef4444);
  color: white; padding: 10px 20px; border-radius: 100px; text-decoration: none;
  font-weight: 600; margin: 10px 4px; transition: all var(--transition);
  box-shadow: 0 2px 8px rgba(245,158,11,0.3);
}
.affiliate-link:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(245,158,11,0.45); }

/* === Sidebar === */
.article-sidebar { position: sticky; top: 84px; align-self: start; }
.sidebar-widget { background: var(--card-bg); border-radius: var(--radius); padding: 22px; margin-bottom: 20px; border: 1px solid var(--border); box-shadow: var(--shadow-sm); }
.sidebar-widget h3 { margin-bottom: 14px; font-size: 1em; font-weight: 700; }
.sidebar-widget ul { list-style: none; }
.sidebar-widget li { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--border); }
.sidebar-widget li:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
.sidebar-widget a { color: var(--text); text-decoration: none; font-size: 0.88em; line-height: 1.5; transition: color 0.2s; display: block; }
.sidebar-widget a:hover { color: var(--primary); }

/* === Related Articles === */
.related-section { margin-top: 60px; padding-top: 40px; border-top: 2px solid var(--border); }
.related-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; margin-top: 20px; }
.related-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px; transition: var(--transition); }
.related-card:hover { border-color: var(--primary-light); box-shadow: var(--shadow); }
.related-card a { color: var(--text); text-decoration: none; font-weight: 600; font-size: 0.92em; line-height: 1.5; }

/* === Article Footer === */
.article-footer { margin-top: 48px; padding: 24px; background: var(--card-bg); border-radius: var(--radius); border: 1px solid var(--border); text-align: center; color: var(--text-secondary); font-size: 0.9em; }

/* === Share Buttons === */
.share-buttons { display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap; }
.share-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 8px; font-size: 0.85em; font-weight: 600;
  text-decoration: none; transition: var(--transition); border: 1px solid var(--border);
  color: var(--text-secondary); background: var(--card-bg);
}
.share-btn:hover { background: var(--primary); color: white; border-color: var(--primary); }

/* === Footer === */
.site-footer { background: var(--card-bg); border-top: 1px solid var(--border); padding: 40px 0; text-align: center; color: var(--text-muted); font-size: 0.88em; margin-top: 80px; }
.site-footer .container { display: flex; flex-direction: column; gap: 10px; align-items: center; }
.site-footer a { color: var(--text-secondary); text-decoration: none; margin: 0 8px; }
.site-footer a:hover { color: var(--primary); }

/* === Scroll to Top === */
.scroll-top {
  position: fixed; bottom: 30px; right: 30px;
  width: 44px; height: 44px; border-radius: 50%;
  background: var(--primary); color: white; border: none; cursor: pointer;
  font-size: 1.2em; box-shadow: var(--shadow-lg); z-index: 50;
  opacity: 0; transform: translateY(20px); transition: all var(--transition);
  pointer-events: none; display: flex; align-items: center; justify-content: center;
}
.scroll-top.visible { opacity: 1; transform: translateY(0); pointer-events: auto; }
.scroll-top:hover { background: var(--primary-dark); transform: translateY(-3px); }

/* === Responsive === */
@media (max-width: 768px) {
  .hero { padding: 50px 0 40px; }
  .hero h1 { font-size: 1.8em; }
  .hero-stats { gap: 24px; }
  .hero-stats .stat-num { font-size: 1.6em; }
  .card-grid { grid-template-columns: 1fr; }
  .article-page { grid-template-columns: 1fr; }
  .article-sidebar { position: static; margin-top: 40px; }
  .article-header h1 { font-size: 1.5em; }
  nav a { padding: 6px 10px; font-size: 0.85em; }
  .section-title { font-size: 1.25em; }
}

@media (max-width: 480px) {
  .hero-stats { flex-direction: column; gap: 12px; align-items: center; }
  .site-header .container { flex-direction: column; gap: 8px; }
  .article-meta { gap: 10px; font-size: 0.82em; }
}`;

  fs.writeFileSync(path.join(siteDir, 'css', 'style.css'), css);
}

function generateSitemap(siteDir: string, pages: SitePage[]) {
  const urls = pages.map(p => `
  <url>
    <loc>${config.site.url}${p.path}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${p.path === '/' ? '1.0' : '0.8'}</priority>
  </url>`).join('');

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls}
</urlset>`;

  fs.writeFileSync(path.join(siteDir, 'sitemap.xml'), sitemap);
}

function generateRSS(siteDir: string, articles: any[]) {
  const items = articles.slice(0, 20).map(a => `
  <item>
    <title><![CDATA[${a.title}]]></title>
    <link>${config.site.url}/articles/${a.slug}/</link>
    <description><![CDATA[${(a.content || '').replace(/[#*\[\]]/g, '').slice(0, 300)}]]></description>
    <pubDate>${new Date(a.published_at || a.created_at).toUTCString()}</pubDate>
    <guid>${config.site.url}/articles/${a.slug}/</guid>
  </item>`).join('');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${config.site.name}</title>
    <link>${config.site.url}</link>
    <description>${config.site.description}</description>
    <language>zh-CN</language>
    <atom:link href="${config.site.url}/rss.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;

  fs.writeFileSync(path.join(siteDir, 'rss.xml'), rss);
}

function generateRobots(siteDir: string) {
  const robots = `User-agent: *
Allow: /
Sitemap: ${config.site.url}/sitemap.xml

# AI生成内容，搜索引擎友好
`;

  fs.writeFileSync(path.join(siteDir, 'robots.txt'), robots);
}

function generateAdsTxt(siteDir: string) {
  // ads.txt 需要 pub- 前缀，不是 ca-pub-
  const pubId = config.adsense.publisherId?.replace('ca-', '') || '';
  const adsTxt = `# Google AdSense
google.com, ${pubId}, DIRECT, f08c47fec0942fa0

# 更多广告网络可在此添加
`;

  fs.writeFileSync(path.join(siteDir, 'ads.txt'), adsTxt);
}

function sanitize(name: string): string {
  return name.replace(/[^\w一-龥-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
