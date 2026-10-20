/**
 * 一键体检 · 报告
 *
 * 与前两阵营的区别：报告不按严重度铺开，而是**先按插件分组** ——
 * 因为用户装了一整套，第一眼想看到的是「哪一块有问题」，而不是 200 条流水账。
 *
 * 假绿防治：
 *   - 报告头必须显示「发现了几个插件、跑了几条规则、几条因不适用没跑」
 *   - 一个插件 0 命中也要显示（否则分不清「查了没问题」和「压根没查」）
 */

import { SEVERITY_LABEL } from '@deepwhale-cn/dsh-guard-core';

const SEV_ORDER = ['critical', 'high', 'medium', 'low', 'info'];
const SEV_ICON = { critical: '💀', high: '🔴', medium: '🟡', low: '🔵', info: '⚪' };

function bySeverity(findings) {
  const m = {};
  for (const f of findings) m[f.severity || 'medium'] = (m[f.severity || 'medium'] || 0) + 1;
  return m;
}

function sevLine(m) {
  return SEV_ORDER.filter((s) => m[s]).map((s) => `${SEVERITY_LABEL[s] || s} ${m[s]}`).join(' · ');
}

export function textReport({ sources, findings, stats, meta = {}, notApplicable = [] }) {
  const L = [];
  const line = '─'.repeat(66);
  const totalRules = sources.reduce((n, s) => n + s.rules.length, 0);
  const byPlugin = new Map(sources.map((s) => [s.short, []]));
  for (const f of findings) {
    const short = f._plugin || '?';
    if (!byPlugin.has(short)) byPlugin.set(short, []);
    byPlugin.get(short).push(f);
  }
  const rows = [...byPlugin.entries()].map(([short, fs]) => ({
    short,
    info: sources.find((s) => s.short === short) || { description: '', rules: [] },
    findings: fs,
  }));
  rows.sort((a, b) => b.findings.length - a.findings.length || a.short.localeCompare(b.short));

  L.push('');
  L.push(`  ${meta.name || '深鲸守护 · 一键体检'} v${meta.version || '0.0.0'}`);
  L.push(`  ${line}`);
  L.push(`  扫描范围   ${stats.root}`);
  L.push(`             ${stats.scannedFiles} 个文件 · ${stats.skippedDirs} 个目录已跳过${stats.truncated ? ' · ⚠️ 已达上限截断' : ''}`);
  L.push(`  已装插件   ${sources.length} 个 · ${totalRules} 条规则`);
  L.push(`  检查规则   ${stats.rulesRun}/${stats.rulesTotal} 条${notApplicable.length ? `（${notApplicable.length} 条因不适用本项目未运行）` : ''}${stats.ruleErrors?.length ? ` · ⚠️ ${stats.ruleErrors.length} 条规则出错` : ''}`);
  const sev = bySeverity(findings);
  L.push(`  命中       ${findings.length} 条${findings.length ? `（${sevLine(sev)}）` : ''}`);
  L.push('');

  L.push('  ── 按插件 ──────────────────────────────────────');
  for (const r of rows) {
    const m = bySeverity(r.findings);
    const desc = (r.info.description || '').slice(0, 28);
    if (!r.findings.length) {
      L.push(`  ✅ ${r.short.padEnd(24)} ${String(r.info.rules.length).padStart(2)} 条规则 · 0 命中   ${desc}`);
    } else {
      const worst = SEV_ORDER.find((s) => m[s]) || 'medium';
      L.push(`  ${SEV_ICON[worst] || '🔴'} ${r.short.padEnd(24)} ${String(r.info.rules.length).padStart(2)} 条规则 · ${r.findings.length} 命中（${sevLine(m)}）`);
    }
  }
  L.push('');

  if (notApplicable.length) {
    L.push('  ── 不适用（本项目未触发，不是"查过了"）────────────');
    L.push(`  ${notApplicable.join(', ')}`);
    L.push('');
  }

  if (!findings.length) {
    L.push('  ✅ 未发现提示项');
    L.push(`     （已扫描 ${stats.scannedFiles} 个文件、执行 ${stats.rulesRun} 条规则 —— 这不是"没查"，是真的没有命中）`);
    if (stats.scannedFiles < 5) {
      L.push('  ⚠️  扫描到的文件很少，请确认目录是否正确');
    }
    L.push('');
  } else {
    L.push('  ── 明细 ────────────────────────────────────────');
    for (const sevKey of SEV_ORDER) {
      const group = findings.filter((f) => (f.severity || 'medium') === sevKey);
      if (!group.length) continue;
      L.push('');
      L.push(`  【${SEVERITY_LABEL[sevKey] || sevKey}】${group.length} 条`);
      for (const f of group) {
        const loc = f.line ? `${f.file}:${f.line}` : f.file;
        L.push(`    ${SEV_ICON[sevKey] || '·'} [${f._plugin}] ${f.ruleId}  ${f.title}`);
        L.push(`      ${loc}`);
        if (f.source) L.push(`      依据：${f.source.slice(0, 110)}${f.source.length > 110 ? '…' : ''}`);
        if (f.advice) L.push(`      怎么办：${f.advice.slice(0, 110)}${f.advice.length > 110 ? '…' : ''}`);
      }
    }
    L.push('');
  }

  L.push(`  ${line}`);
  L.push('  提示确认，不是判定违规。每条命中都附依据，可自行核对原文。');
  L.push('');
  return L.join('\n');
}

export function jsonReport({ sources, findings, stats, meta = {}, notApplicable = [] }) {
  const byPlugin = new Map();
  for (const s of sources) byPlugin.set(s.short, { short: s.short, name: s.name, description: s.description, rules: s.rules.length, findings: 0, bySeverity: {} });
  for (const f of findings) {
    const row = byPlugin.get(f._plugin);
    if (!row) continue;
    row.findings += 1;
    const s = f.severity || 'medium';
    row.bySeverity[s] = (row.bySeverity[s] || 0) + 1;
  }
  return JSON.stringify(
    {
      name: meta.name,
      version: meta.version,
      generatedAt: new Date().toISOString(),
      // 与单插件报告保持兼容：下游（dsh-compliance-doc）只认这两个字段
      stats,
      findings,
      suite: {
        plugins: [...byPlugin.values()],
        pluginCount: sources.length,
        rulesTotal: sources.reduce((n, s) => n + s.rules.length, 0),
        notApplicable,
      },
    },
    null,
    2,
  );
}
