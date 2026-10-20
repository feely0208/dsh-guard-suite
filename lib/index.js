import { createPlugin, pkgRootFrom } from '@deepwhale-cn/dsh-guard-core/plugin';

export const { name, inject, apply } = createPlugin({
  name: 'guard-suite',
  pkgRoot: pkgRootFrom(import.meta.url),
  skillFile: 'skill/guard-suite.md',
  binFile: 'bin/cli.mjs',
  description: '跑一遍全部适用的检查，出一份总报告',
  whenToUse: '想一次性看清一个项目在合规/安全上「有哪些问题、分在哪些块」时用。'
    + '用户会说：「帮我整体体检一下」「我装了这么多检查插件，能不能一次跑完」'
    + '「给我一份能直接看的检查报告」「上线前想统一扫一遍」'
    + '「按模块告诉我哪里有问题」。注意：它不新增判据，只跑你已经装了的守卫插件；'
    + '一个插件都没装时它会明确报错，而不是假装全绿。',
});
