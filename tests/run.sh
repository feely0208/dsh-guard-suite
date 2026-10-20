#!/bin/bash
# dsh-guard-suite · 行为验证
#
# 这个插件不新增判据，所以「双向验证」验的不是规则，而是**编排行为**：
#   聚合对不对（几个插件、几条规则、每个插件几条命中）
#   过滤对不对（--only / --skip）
#   错误场景对不对（一个规则源都没有时必须 exit 2，不许报全绿）
#   不适用能不能被看见（不能混进「0 命中」）
set -uo pipefail
export PATH="/usr/local/bin:$PATH"
cd "$(dirname "$0")/.."
PASS=0; FAIL=0
ok(){ echo "  ✅ $1"; PASS=$((PASS+1)); }
bad(){ echo "  ❌ $1"; FAIL=$((FAIL+1)); }

FP="tests/fixtures/plugins"
FAILP="tests/fixtures/fail/demo-project"
PASSP="tests/fixtures/pass/clean-project"

echo ""; echo "  $(node -p "require('./package.json').name") · 行为验证"
echo "  ────────────────────────────────────────────────"

echo ""; echo "  【发现】只认 --rules-from 指定的目录，且能识别插件与规则数"
L=$(node bin/cli.mjs --rules-from "$FP" --list-plugins 2>&1)
echo "$L" | grep -q "已装守卫插件 3 个" && ok "发现 3 个演示插件" || bad "插件数不对：$(echo "$L" | head -2)"
echo "$L" | grep -q "共 3 条规则" && ok "共 3 条规则" || bad "规则数不对"
echo "$L" | grep -q "fake-a" && echo "$L" | grep -q "fake-b" && echo "$L" | grep -q "fake-c" \
  && ok "三个插件都在清单里" || bad "插件清单缺项"

echo ""; echo "  【聚合】正例项目：每条规则都要报，且分组到正确的插件"
J=$(node bin/cli.mjs --rules-from "$FP" --root "$FAILP" --json 2>&1)
node -e '
const d=JSON.parse(process.argv[1]);
const ids=d.findings.map(f=>f.ruleId).sort();
const want=["FAKE-ENV-SECRET","FAKE-NO-LICENSE"];
const okIds=JSON.stringify(ids)===JSON.stringify(want);
const byP=Object.fromEntries(d.suite.plugins.map(p=>[p.short,p.findings]));
const okP=byP["fake-a"]===1 && byP["fake-b"]===1 && byP["fake-c"]===0;
const okNA=(d.suite.notApplicable||[]).includes("fake-c:FAKE-WHEN-DEMO");
console.log(JSON.stringify({okIds,okP,okNA,ids,byP,na:d.suite.notApplicable}));
process.exit(okIds&&okP&&okNA?0:1);
' "$J" > /tmp/suite-agg.json 2>&1 && ok "命中聚合正确（2 条，分属 fake-a / fake-b）" || bad "聚合不对：$(cat /tmp/suite-agg.json)"
python3 - <<'PY' && ok "「不适用」被单独列出（FAKE-WHEN-DEMO）" || bad "不适用规则没有出现在报告的 notApplicable 里"
import json
d=json.load(open('/tmp/suite-agg.json'))
assert d['okNA'] is True, d
PY

echo ""; echo "  【反例】干净项目必须 0 命中，且退出码 0"
M=$(node bin/cli.mjs --rules-from "$FP" --root "$PASSP" --quiet 2>&1 | grep -oE '^[0-9]+' | head -1)
[ "${M:-1}" = "0" ] && ok "干净样本 0 命中" || bad "误报 ${M} 条"
node bin/cli.mjs --rules-from "$FP" --root "$PASSP" --quiet >/dev/null 2>&1
[ $? -eq 0 ] && ok "干净项目退出码 0" || bad "干净项目退出码不是 0"

echo ""; echo "  【退出码】高危命中必须返回 1（可挂 CI）"
node bin/cli.mjs --rules-from "$FP" --root "$FAILP" --quiet >/dev/null 2>&1
[ $? -eq 1 ] && ok "有高危命中 → exit 1" || bad "exit 码不对（应为 1）"

echo ""; echo "  【过滤】--only 只跑指定的插件"
O=$(node bin/cli.mjs --rules-from "$FP" --root "$FAILP" --only fake-a --json 2>&1)
echo "$O" | python3 -c '
import json,sys
d=json.load(sys.stdin)
ids={f["ruleId"] for f in d["findings"]}
assert ids=={"FAKE-ENV-SECRET"}, ids
assert d["suite"]["pluginCount"]==1, d["suite"]["pluginCount"]
' 2>/dev/null && ok "--only fake-a 只剩 1 条命中 / 1 个插件" || bad "--only 过滤没生效"

echo ""; echo "  【错误场景】一个规则源都没有时，必须 exit 2 并说清楚（绝不当全绿）"
EMPTY=$(mktemp -d)
OUT=$(node bin/cli.mjs --rules-from "$EMPTY" --root "$FAILP" 2>&1); CODE=$?
rmdir "$EMPTY" 2>/dev/null || true
[ "$CODE" -eq 2 ] && ok "exit 2" || bad "应为 exit 2，实际 $CODE"
echo "$OUT" | grep -q "不是\"项目没问题\"" && ok "错误信息明确区分了「没查」与「没问题」" || bad "错误信息不明确"

echo ""; echo "  【演示】--demo 必须能直接跑通（报告格式可见）"
D=$(node bin/cli.mjs --demo 2>&1)
echo "$D" | grep -q "演示模式" && ok "--demo 有明确标识" || bad "--demo 缺标识"
echo "$D" | grep -q "按插件" && ok "--demo 报告含「按插件」分组" || bad "--demo 报告缺分组"

echo ""; echo "  【不假绿】正常输出必须带扫描范围与规则计数"
T=$(node bin/cli.mjs --rules-from "$FP" --root "$FAILP" 2>&1)
echo "$T" | grep -q "扫描范围" && ok "报告头有扫描范围" || bad "报告头缺扫描范围"
echo "$T" | grep -q "已装插件" && ok "报告头有插件/规则计数" || bad "报告头缺规则计数"

echo ""; echo "  ────────────────────────────────────────────────"
echo "  通过 $PASS · 失败 $FAIL"; echo ""
[ "$FAIL" -eq 0 ] || exit 1
