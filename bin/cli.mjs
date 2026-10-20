#!/usr/bin/env node
/**
 * 深鲸守护 · 一键体检（dsh-guard-suite）
 *
 * 用法：dsh-guard-suite [--root <目录>] [--json] [--html out.html] [--list-plugins]
 *                      [--only a,b] [--skip c] [--rules-from <dir>] [--demo] [--quiet]
 *
 * 它不新增任何判据 —— 只把「你已经装了的守卫插件」的规则集合起来跑一遍。
 * 所以它的价值全在「聚合 + 报告」，风险也全在「发现不到插件却报全绿」，
 * 这条红线在下面两处体现：发现 0 个规则源 → exit 2；报告头必须写清扫了多少。
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scan } from '@deepwhale-cn/dsh-guard-core';
import { htmlReport } from '@deepwhale-cn/dsh-guard-core/report';
import { discoverRuleSources, ruleIndex } from '../lib/discover.mjs';
import { textReport, jsonReport } from '../lib/report.mjs';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf-8'));
const META = { name: '深鲸守护 · 一键体检', version: pkg.version };

const argv = process.argv.slice(2);
const opt = {
  root: process.cwd(), json: false, html: null, listPlugins: false, demo: false, quiet: false,
  only: [], skip: [], rulesFrom: [], failOn: 'high',
};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--root') opt.root = argv[++i];
  else if (a === '--json') opt.json = true;
  else if (a === '--html') opt.html = argv[++i];
  else if (a === '--list-plugins') opt.listPlugins = true;
  else if (a === '--demo') opt.demo = true;
  else if (a === '--quiet') opt.quiet = true;
  else if (a === '--only') opt.only.push(...String(argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean));
  else if (a === '--skip') opt.skip.push(...String(argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean));
  else if (a === '--rules-from') opt.rulesFrom.push(...String(argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean));
  else if (a === '--fail-on') opt.failOn = argv[++i];
  else if (a === '-h' || a === '--help') { help(); process.exit(0); }
  else { console.error(`\n  ❌ 不认识的参数：${a}\n     用 --help 看用法\n`); process.exit(2); }
}

// 演示模式：用内置假插件 + 内置问题样本，只演示报告长什么样
if (opt.demo) {
  opt.root = join(pkgRoot, 'tests', 'fixtures', 'fail', 'demo-project');
  opt.rulesFrom = [join(pkgRoot, 'tests', 'fixtures', 'plugins')];
}

const { sources: allSources, searched } = discoverRuleSources({ pkgRoot, extraDirs: opt.rulesFrom });

if (!allSources.length) {
  // ⛔ 全插件最重要的一个 if：宁可报错，也不能"0 命中"。
  console.error('');
  console.error('  ❌ 没有发现任何守卫插件的规则 —— 无法体检。');
  console.error('');
  console.error('     这不是"项目没问题"，是"一条规则都没跑"。');
  console.error('');
  console.error('  已搜索：');
  for (const s of searched) console.error(`     - ${s}${existsSync(s) ? '' : '（不存在）'}`);
  console.error('');
  console.error('  怎么办：');
  console.error('     1) 先装几个守卫插件，例如：dsh plugin --profile web add @deepwhale-cn/dsh-cn-mlps');
  console.error('     2) 或者用 --rules-from <目录> 指向你放 dsh-* 插件的目录');
  console.error('     3) 检查环境变量 DSH_GUARD_PLUGINS（冒号分隔的插件目录）');
  console.error('');
  process.exit(2);
}

const onlySet = new Set(opt.only);
const skipSet = new Set(opt.skip);
const sources = allSources.filter((s) => {
  if (onlySet.size && !onlySet.has(s.short)) return false;
  if (skipSet.has(s.short)) return false;
  return true;
});

if (!sources.length) {
  console.error(`\n  ❌ --only/--skip 过滤后没有剩下任何插件（原有 ${allSources.length} 个）。\n`);
  process.exit(2);
}

if (opt.listPlugins) {
  const total = sources.reduce((n, s) => n + s.rules.length, 0);
  console.log(`\n  已装守卫插件 ${sources.length} 个 · 共 ${total} 条规则\n`);
  for (const s of sources) {
    console.log(`  ${s.short.padEnd(24)} ${String(s.rules.length).padStart(3)} 条   ${s.description}`);
  }
  console.log('');
  process.exit(0);
}

// 汇总规则，并记下「这条规则属于哪个插件」
const rules = [];
for (const s of sources) {
  for (const r of s.rules) rules.push({ ...r, _plugin: s.short });
}
const { index, duplicateIds } = ruleIndex(sources);
if (duplicateIds.length) {
  console.error(`\n  ⚠️  规则 id 重复（后出现的会被覆盖分组）：${[...new Set(duplicateIds)].join(', ')}\n`);
}

const { findings, stats, notApplicable, perRule } = scan({
  root: opt.root,
  rules,
  rootLabel: opt.demo ? '内置演示样本 · 故意有问题的项目' : null,
});

for (const f of findings) f._plugin = index.get(f.ruleId) || '?';
const notApplicableWithPlugin = notApplicable.map((id) => `${index.get(id) || '?'}:${id}`);
if (perRule.some((r) => r.error)) stats.ruleErrors = perRule.filter((r) => r.error);

if (opt.json) {
  console.log(jsonReport({ sources, findings, stats, meta: META, notApplicable: notApplicableWithPlugin }));
} else if (opt.quiet) {
  console.log(`${findings.length} 条命中 · 扫描 ${stats.scannedFiles} 文件 · ${sources.length} 插件 / ${stats.rulesRun} 规则`);
} else {
  if (opt.demo) console.log('\n  【演示模式】使用内置样本与演示插件，只展示报告格式；真实体检请在你的项目目录运行。\n');
  console.log(textReport({ sources, findings, stats, meta: META, notApplicable: notApplicableWithPlugin }));
}

if (opt.html) {
  writeFileSync(opt.html, htmlReport({ findings, stats, meta: META }), 'utf-8');
  if (!opt.quiet && !opt.json) console.log(`  HTML 报告已写入：${opt.html}\n`);
}

// 退出码：默认 high 以上命中 → 1（可挂 CI）；--fail-on 可收紧
const sevRank = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };
const threshold = sevRank[opt.failOn] ?? 3;
const worst = findings.reduce((m, f) => Math.max(m, sevRank[f.severity] ?? 2), -1);
process.exit(worst >= threshold ? 1 : 0);

function help() {
  console.log(`
  ${pkg.name} v${pkg.version}
  ${pkg.description}

  用法：
    dsh-guard-suite [选项]

  选项：
    --root <dir>        扫描目录（默认当前目录）
    --list-plugins      列出发现到的插件与规则条数（先确认"装没装全"）
    --only a,b          只跑指定插件（短名，如 cn-mlps,cn-log-retention）
    --skip c            跳过指定插件
    --rules-from <dir>  只从指定目录找插件（可逗号分隔；给了就不自动搜索）
    --json              JSON 输出（给 CI / 下游文档生成）
    --html <file>       额外输出 HTML 报告
    --demo              用内置演示样本看报告格式
    --quiet             只输出结论行
    --fail-on <sev>     high（默认）| medium | low | info
    -h, --help          显示帮助

  退出码：
    0  没有达到 --fail-on 的命中
    1  有达到 --fail-on 的命中
    2  参数错误 / 一个插件规则都没发现（绝不当作"全绿"）
`);
}
