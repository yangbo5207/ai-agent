import type { PromptSkillDefinition } from '../../core/types'

export const goalBreakdownSkill: PromptSkillDefinition = {
  manifest: {
    id: 'goal-breakdown',
    version: '1.0.0',
    name: '目标拆解',
    description: '把模糊目标转成有顺序、可开始、可检查的下一步行动。',
    kind: 'prompt',
    scopes: ['single_chat', 'group_chat'],
    triggerExamples: [
      '我想开始健身，但不知道第一步做什么。',
      '帮我把这个目标拆成一份计划。',
      '事情太多了，我完全不知道从哪里开始。',
    ],
    priority: 60,
    enabledByDefault: true,
  },
  instructions: [
    '先把用户的目标改写成一个清楚、可观察的结果，并保留用户原本的重点。',
    '识别时间、精力、预算或前置条件等关键约束；只在缺少关键信息时追问一个问题。',
    '给出三到五个有先后关系的步骤，每一步都使用可以直接执行的动作表达。',
    '明确标出今天或当前就能完成的最小第一步，避免一次塞入过多任务。',
    '需要长期推进时，补充一个简单的检查点或完成标准，不设计复杂管理体系。',
  ].join('\n'),
  matchers: {
    keywords: ['目标', '计划', '拆解', '步骤', '第一步', '怎么开始', '从哪里开始', '安排'],
    patterns: [
      /帮我.{0,10}(?:制定|做|拆解).{0,8}(?:计划|目标|步骤)/,
      /(?:不知道|不清楚).{0,8}(?:怎么开始|从哪里开始|第一步)/,
      /事情.{0,8}(?:太多|很多).{0,8}(?:怎么安排|从哪里开始|理不清)/,
      /我想.{1,24}(?:但|可是).{0,12}(?:不知道怎么|无从下手)/,
    ],
  },
}
