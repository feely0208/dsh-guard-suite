# @deepwhale-cn/dsh-guard-suite

[![dshfind 收录](https://dshfind.com/api/badge/feely0208/dsh-guard-suite?lang=zh)](https://dshfind.com/zh/plugins/feely0208/dsh-guard-suite)

[![Listed on dsh-plugin.org](https://dsh-plugin.org/badges/listed.svg)](https://dsh-plugin.org/zh/plugins/feely0208/dsh-guard-suite)

**装了一堆守卫插件，却要一个个跑？一条命令跑完全部，出一份按模块分组的体检报告。**

**关键词**：一键体检 · 合规检查 · 安全检查 · 批量扫描 · 安全报告 · 等保自查 · 上线检查 · CI 卡口

---

## 先说清楚它是什么、不是什么

**是**：体检编排器。把你**已经装好的**守卫插件规则集合起来，一次扫描、一份分组报告 ——
哪一块有问题、几处、依据是什么、文件在哪一行，一眼看完。

**不是**：新的判据库。它自己**一条规则都没有**。判据全部来自你装的那 30 多个插件，
找到几个跑几个。

---

## 为什么单独需要它

单个插件的报告是「一条一件事」。真到要交材料的时候，你要的不是 30 份报告，是**一份能看的结论**。

```bash
# 以前：一条条跑
dsh-cn-mlps --root ./my-app
dsh-cn-log-retention --root ./my-app
dsh-consent-guard --root ./my-app
...

# 现在：跑一遍，按插件分组
dsh-guard-suite --root ./my-app
```

## 安装

```bash
dsh plugin --profile web add @deepwhale-cn/dsh-guard-suite
# 再把你要跑的守卫插件装上（不装的那个就不会被体检）
dsh plugin --profile web add @deepwhale-cn/dsh-cn-mlps
```

## 用法

```bash
dsh-guard-suite --list-plugins                    # 先看"装全了没"
dsh-guard-suite --root ./my-app                   # 体检
dsh-guard-suite --root ./my-app --json            # 给 CI / 给文档生成用
dsh-guard-suite --root ./my-app --html 体检.html   # HTML 报告（可截图存档）
dsh-guard-suite --only cn-mlps,cn-log-retention    # 只跑两块
dsh-guard-suite --skip cn-crypto                   # 跳过某块
dsh-guard-suite --fail-on medium                   # CI 卡口（默认 high）
```

## 报告长什么样

```
  已装插件   30 个 · 139 条规则
  检查规则   120/139 条（19 条因不适用本项目未运行）
  命中       58 条（高 17 · 中 35 · 低 6）

  ── 按插件 ──────────────────────────────────
  🔴 cn-mlps        5 条规则 · 10 命中（高 5 · 中 5）
  ✅ ai-output-trust 4 条规则 · 0 命中

  ── 不适用（本项目未触发，不是"查过了"）────────
  algorithm-filing:ALGO-NO-FILING, ...
```

**0 命中的插件也会显示** —— 否则你分不清「查了没问题」和「压根没查」。
**不适用的规则单独列出** —— 「没跑」和「跑过且通过」是两件事。

## 一个刻意做"硬"的地方

一个插件规则都没发现时，它**直接报错退出**（exit 2），并列出搜过哪些路径：

```
  ❌ 没有发现任何守卫插件的规则 —— 无法体检。
     这不是"项目没问题"，是"一条规则都没跑"。
```

「0 命中」和「一条规则都没跑」在终端上长得一模一样，这是静态检查工具最常见的假绿。
宁可让你看到报错，也不给你一个假的「全部通过」。

## 它怎么找到插件

按顺序找，**不联网、不下载**：

1. `--rules-from <目录>`（给了就只用这些，便于可复现）
2. 与本插件同级的 `dsh-*` 目录
3. `node_modules/@deepwhale-cn/dsh-*`
4. 环境变量 `DSH_GUARD_PLUGINS`（冒号分隔）

## 退出码

| 码 | 含义 |
|---|---|
| 0 | 没有达到 `--fail-on` 的命中 |
| 1 | 有达到阈值的命中（可挂 CI） |
| 2 | 参数错误，或一个规则源都没发现（**不当作全绿**） |

## 它不做什么

- 不联网、不上传代码、不下载规则。
- 不判定「合规/不合规」，只报事实 + 依据，供你确认。
- 不替代等保测评、监管检查或第三方审计。

---

## 关于这条产品线

这是「深鲸守护」系列的第 32 个插件。前 31 个各查一件事，这一个把它们串成一次体检。
每个插件都本地跑、代码不外传、每条规则都标**可查证的依据**（法条 / 国标 / OWASP / ATT&CK 编号）。

更多：[deepwhale.org.cn/guard.html](https://www.deepwhale.org.cn/guard.html)

## 深鲸网安守护系列（共 39 个）

> 一个插件做一件事。**安全问题是链式的** —— 配套用才完整。

**国内合规**（12）｜ [等保对照](https://github.com/feely0208/dsh-cn-mlps) · [日志留存](https://github.com/feely0208/dsh-cn-log-retention) · [备案公示](https://github.com/feely0208/dsh-cn-filing) · [用户同意](https://github.com/feely0208/dsh-consent-guard) · [个人信息权利](https://github.com/feely0208/dsh-data-rights) · [未成年人保护](https://github.com/feely0208/dsh-minor-guard) · [影响评估](https://github.com/feely0208/dsh-pipia) · [数据分类分级](https://github.com/feely0208/dsh-data-classify) · [算法备案](https://github.com/feely0208/dsh-algorithm-filing) · [数据出境](https://github.com/feely0208/dsh-cn-data-export) · [国密合规](https://github.com/feely0208/dsh-cn-crypto) · [AI 内容标识](https://github.com/feely0208/dsh-cn-ai-labeling)

**AI 与 Agent 治理**（6）｜ [AI 输出信任](https://github.com/feely0208/dsh-ai-output-trust) · [外部内容信任](https://github.com/feely0208/dsh-content-trust) · [MCP 安全](https://github.com/feely0208/dsh-mcp-audit) · [Agent 权限](https://github.com/feely0208/dsh-agent-scope) · [策略核对](https://github.com/feely0208/dsh-agent-policy) · [可疑指令](https://github.com/feely0208/dsh-phishing-guard)

**数据与凭据**（5）｜ [敏感数据](https://github.com/feely0208/dsh-data-scan) · [密钥轮换](https://github.com/feely0208/dsh-key-rotate) · [数据留存](https://github.com/feely0208/dsh-data-lifecycle) · [配置审计](https://github.com/feely0208/dsh-env-audit) · [密钥扫描](https://github.com/feely0208/dsh-secret-scan)

**供应链与构建**（5）｜ [开源许可](https://github.com/feely0208/dsh-license-guard) · [依赖投毒](https://github.com/feely0208/dsh-dep-audit) · [CI 安全](https://github.com/feely0208/dsh-ci-guard) · [工具审查](https://github.com/feely0208/dsh-tool-vet) · [物料清单](https://github.com/feely0208/dsh-sbom)

**权限与应急**（3）｜ [最小权限](https://github.com/feely0208/dsh-least-privilege) · [告警外发](https://github.com/feely0208/dsh-alert-relay) · [应急证据包](https://github.com/feely0208/dsh-incident-package)

**行业专项**（4）｜ [医疗行业专项](https://github.com/feely0208/dsh-industry-medical) · [教育行业专项](https://github.com/feely0208/dsh-industry-education) · [金融行业专项](https://github.com/feely0208/dsh-industry-finance) · [地方数据条例](https://github.com/feely0208/dsh-local-regulation)

**编排与交付**（4）｜ [一键体检](https://github.com/feely0208/dsh-guard-suite) · [改前改后复核](https://github.com/feely0208/dsh-fix-verify) · [合规可交付文档](https://github.com/feely0208/dsh-compliance-doc) · [整改建议](https://github.com/feely0208/dsh-remediation)

都在 DSH 插件市场（dsh-plugin.org）、npm 和 deepwhale.org.cn/guard.html 上。

---

<p align="right"><a href="https://deepwhale.org.cn"><img src="https://www.deepwhale.org.cn/images/badge/deepwhale-badge.png" alt="powered by dwh" height="20"></a></p>
