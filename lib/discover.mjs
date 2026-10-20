/**
 * 规则源发现 —— 「一键体检」的核心。
 *
 * 为什么不能硬编码 29 个包名：
 *   用户可能只装了其中一部分（只装等保、只装日志），也可能装在别的位置
 *   （dsh-home 的 plugins 目录 / node_modules / 仓库同级目录）。
 *   硬编码的结果是「没装的插件静默消失 → 报告里少了几十项 → 看着全绿」，这就是假绿。
 *
 * 假绿红线（本文件唯一重要的事）：
 *   发现 0 个规则源时，**必须让调用方明确失败**（exit 2 + 说清怎么指定），
 *   绝对不允许返回空数组，让上层打印「0 命中，全部通过」。
 */

import { readdirSync, readFileSync, existsSync, statSync, realpathSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

// 这些包本身不含判据，发现到了也不该纳入（它们是编排工具）
const SKIP_SHORT = new Set(['guard-suite', 'fix-verify', 'compliance-doc', 'guard-core']);

/** 读一个插件目录的 rules/*.json；没有可用规则返回 null */
export function loadRulesFrom(dir) {
  const rdir = join(dir, 'rules');
  if (!existsSync(rdir)) return null;
  let files = [];
  try {
    files = readdirSync(rdir).filter((f) => f.endsWith('.json')).sort();
  } catch {
    return null;
  }
  const rules = [];
  for (const f of files) {
    try {
      const r = JSON.parse(readFileSync(join(rdir, f), 'utf-8'));
      if (r && r.id && r.check) rules.push(r);
    } catch {
      /* 坏文件跳过：门 2（lint）会单独报，不要在这里静默吞掉整包 */
    }
  }
  return rules.length ? rules : null;
}

function pluginInfo(dir) {
  let pkg = {};
  try {
    pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'));
  } catch {
    /* 没有 package.json 也允许：只要 rules 在就行 */
  }
  const raw = pkg.name ? String(pkg.name) : basename(dir);
  const short = raw.replace(/^@[^/]+\//, '').replace(/^dsh-/, '');
  return { short, name: raw, description: pkg.description || '', dir };
}

/** 把「一个目录」展开成「一批插件目录」：目录本身是插件，或它下面有 dsh-* */
function expand(dir) {
  if (!dir || !existsSync(dir)) return [];
  if (existsSync(join(dir, 'rules'))) return [dir];
  const out = [];
  try {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      try {
        if (!statSync(p).isDirectory()) continue;
      } catch {
        continue;
      }
      if (!e.startsWith('dsh-')) continue;
      out.push(p);
    }
  } catch {
    /* 无权限读就当作没有 */
  }
  return out;
}

/**
 * @param {object} o
 * @param {string} o.pkgRoot          本插件根目录
 * @param {string[]} o.extraDirs      --rules-from 指定的目录（给了就【只】用这些，便于测试与可复现）
 * @returns {{sources: Array, searched: string[]}}
 */
export function discoverRuleSources({ pkgRoot, extraDirs = [] } = {}) {
  const out = [];
  const seen = new Set();
  const searched = [];

  const addDir = (dir) => {
    let real;
    try {
      real = realpathSync(dir);
    } catch {
      return;
    }
    if (seen.has(real)) return;
    seen.add(real);
    const rules = loadRulesFrom(real);
    if (!rules) return;
    const info = pluginInfo(real);
    if (SKIP_SHORT.has(info.short)) return;
    out.push({ ...info, rules });
  };

  if (extraDirs.length) {
    for (const d of extraDirs) {
      searched.push(d);
      for (const p of expand(d)) addDir(p);
    }
    return { sources: sortSources(out), searched };
  }

  const roots = [dirname(pkgRoot)];
  roots.push(join(pkgRoot, 'node_modules', '@deepwhale-cn'));
  roots.push(join(dirname(pkgRoot), 'node_modules', '@deepwhale-cn'));
  if (process.env.DSH_GUARD_PLUGINS) {
    roots.push(...process.env.DSH_GUARD_PLUGINS.split(':').filter(Boolean));
  }
  for (const r of roots) {
    searched.push(r);
    for (const p of expand(r)) addDir(p);
  }
  return { sources: sortSources(out), searched };
}

function sortSources(list) {
  return list.sort((a, b) => a.short.localeCompare(b.short));
}

/** 规则 id → 插件短名（报告分组用） */
export function ruleIndex(sources) {
  const m = new Map();
  const dup = [];
  for (const s of sources) {
    for (const r of s.rules) {
      if (m.has(r.id)) dup.push(r.id);
      else m.set(r.id, s.short);
    }
  }
  return { index: m, duplicateIds: dup };
}
