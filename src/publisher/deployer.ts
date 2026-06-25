/**
 * 自动部署模块
 * 支持 Vercel 和 Cloudflare Pages 一键部署
 */

import { config } from '../config.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function deploy(siteDir: string): Promise<{ success: boolean; url?: string; error?: string }> {
  console.log(`\n🚀 ===== 自动部署: ${config.deploy.provider} =====`);

  try {
    if (config.deploy.provider === 'vercel') {
      return deployToVercel(siteDir);
    } else if (config.deploy.provider === 'cloudflare') {
      return deployToCloudflare(siteDir);
    } else {
      return deployToNetlify(siteDir);
    }
  } catch (error: any) {
    console.error('   部署失败:', error.message);
    return { success: false, error: error.message };
  }
}

async function deployToVercel(siteDir: string): Promise<{ success: boolean; url?: string }> {
  if (!config.deploy.vercelToken) {
    console.log('   ⚠️ 未配置 VERCEL_TOKEN，跳过部署');
    console.log(`   📁 网站已生成在: ${siteDir}`);
    console.log('   💡 手动部署: cd sites && npx vercel --prod');
    return { success: false };
  }

  console.log('   📤 部署到 Vercel...');

  try {
    // 创建 vercel.json (支持 API 函数 + Cron 定时任务)
    const fs = await import('fs');
    fs.writeFileSync(`${siteDir}/vercel.json`, JSON.stringify({
      version: 2,
      builds: [
        { src: 'api/**/*.js', use: '@vercel/node' },
        { src: '**/*', use: '@vercel/static' },
      ],
      routes: [
        { src: '/api/(.*)', dest: '/api/$1' },
        { src: '/articles/(.*)', dest: '/articles/$1/index.html' },
        { src: '/(.*)', dest: '/$1' },
      ],
      crons: [
        {
          path: '/api/generate',
          schedule: '0 0 * * *', // 每天UTC 0点 = 北京时间8点（免费版限制每天1次）
        },
      ],
    }, null, 2));

    const { stdout } = await execAsync(`cd "${siteDir}" && npx vercel --prod --token ${config.deploy.vercelToken} --yes`, {
      timeout: 120000,
    });

    const urlMatch = stdout.match(/https:\/\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : undefined;

    console.log(`   ✅ 部署成功: ${url || '查看 Vercel Dashboard'}`);
    return { success: true, url };
  } catch (error: any) {
    console.log('   ⚠️ Vercel CLI 部署失败（可手动部署）');
    return { success: false, error: error.message };
  }
}

async function deployToCloudflare(siteDir: string): Promise<{ success: boolean; url?: string }> {
  if (!config.deploy.cloudflareToken) {
    console.log('   ⚠️ 未配置 CLOUDFLARE_API_TOKEN，跳过部署');
    console.log(`   📁 网站已生成在: ${siteDir}`);
    console.log('   💡 手动部署: npx wrangler pages deploy sites/');
    return { success: false };
  }

  console.log('   📤 部署到 Cloudflare Pages...');

  try {
    const { stdout } = await execAsync(
      `npx wrangler pages deploy "${siteDir}" --project-name="${config.site.name}"`,
      {
        timeout: 120000,
        env: { ...process.env, CLOUDFLARE_API_TOKEN: config.deploy.cloudflareToken },
      }
    );

    const urlMatch = stdout.match(/https:\/\/[^\s]+\.pages\.dev/);
    const url = urlMatch ? urlMatch[0] : undefined;

    console.log(`   ✅ 部署成功: ${url || '查看 Cloudflare Dashboard'}`);
    return { success: true, url };
  } catch (error: any) {
    console.log('   ⚠️ Cloudflare 部署失败（可手动部署）');
    return { success: false, error: error.message };
  }
}

async function deployToNetlify(siteDir: string): Promise<{ success: boolean; url?: string }> {
  console.log('   📤 部署到 Netlify...');

  try {
    // 简单方案：不需要token，用netlify-cli
    const { stdout } = await execAsync(
      `cd "${siteDir}" && npx netlify-cli deploy --prod --dir=.`,
      { timeout: 120000 }
    );

    const urlMatch = stdout.match(/https:\/\/[^\s]+\.netlify\.app/);
    const url = urlMatch ? urlMatch[0] : undefined;

    console.log(`   ✅ 部署成功: ${url || '查看 Netlify Dashboard'}`);
    return { success: true, url };
  } catch (error: any) {
    console.log('   ⚠️ Netlify 部署失败（可手动部署）');
    return { success: false, error: error.message };
  }
}

/**
 * 本地预览
 */
export async function previewLocally(siteDir: string): Promise<void> {
  console.log(`\n👀 本地预览: cd "${siteDir}" && npx serve .`);
  console.log('   💡 安装serve: npm install -g serve');
}
