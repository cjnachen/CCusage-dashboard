/**
 * CCUsage Dashboard - 静态导出脚本
 * 用法: node export.js
 * 输出: dist/index.html （可直接部署到 Netlify / Vercel / GitHub Pages）
 */
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

function getDateStr(d) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function runCcusage(args) {
  return new Promise((resolve) => {
    exec(`npx -y ccusage@latest ${args}`, { timeout: 90000 }, (_err, stdout) => {
      resolve((stdout || '').trim());
    });
  });
}

function safeParse(raw) {
  if (!raw) return {};
  try { return JSON.parse(raw) || {}; } catch {
    const i = raw.indexOf('{');
    if (i !== -1) try { return JSON.parse(raw.slice(i)) || {}; } catch {}
    return {};
  }
}

async function main() {
  const today = getDateStr(new Date());
  const d90 = new Date(); d90.setDate(d90.getDate() - 89);
  const since90 = getDateStr(d90);

  console.log('⏳ 正在从 ccusage 获取数据（约 30 秒）...\n');

  const [todayData, dailyData, weeklyData, monthlyData] = await Promise.all([
    runCcusage(`daily --since ${today} --until ${today} --json`).then(safeParse),
    runCcusage(`daily --since ${since90} --until ${today} --json`).then(safeParse),
    runCcusage('weekly --json').then(safeParse),
    runCcusage('monthly --json').then(safeParse),
  ]);

  const data = {
    today: todayData,
    daily: dailyData,
    weekly: weeklyData,
    monthly: monthlyData,
    generatedAt: new Date().toISOString(),
    period: { since: since90, until: today },
  };

  // 读取 HTML 模板，注入数据
  const template = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  const injection = `<script>window.__CCUSAGE_DATA__ = ${JSON.stringify(data)};</script>`;
  const output = template.replace('</head>', injection + '\n</head>');

  const docsDir = path.join(__dirname, 'docs');
  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(path.join(docsDir, 'index.html'), output, 'utf8');

  const days   = (dailyData.daily   || []).length;
  const weeks  = (weeklyData.weekly || []).length;
  const months = (monthlyData.monthly || []).length;
  const sizekb = (fs.statSync(path.join(docsDir, 'index.html')).size / 1024).toFixed(1);

  console.log(`✅ 导出完成 → docs/index.html (${sizekb} KB)`);
  console.log(`   数据范围: ${since90} → ${today}`);
  console.log(`   每日: ${days} 天 | 每周: ${weeks} 周 | 每月: ${months} 月\n`);
  console.log('📤 更新线上数据:');
  console.log('   git add docs/ && git commit -m "update usage data" && git push\n');
}

main().catch(console.error);
