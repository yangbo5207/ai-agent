import type { PromptSkillDefinition } from '../../core/types'

export const activeListeningSkill: PromptSkillDefinition = {
  manifest: {
    id: 'active-listening',
    version: '1.0.0',
    name: '主动倾听',
    description: '当用户更需要被听见和接住时，先回应感受，再决定是否追问或给建议。',
    kind: 'prompt',
    scopes: ['single_chat', 'group_chat'],
    triggerExamples: [
      '你先听我说，不要急着给建议。',
      '我今天真的很难过，想找个人陪我聊聊。',
      '我现在脑子很乱，只想把这些说出来。',
    ],
    priority: 70,
    enabledByDefault: true,
  },
  instructions: [
    '先用一两句话准确复述用户正在经历的事情和情绪，不夸大，也不替用户下结论。',
    '先给予具体、克制的情绪确认，再考虑建议；用户明确表示只想倾诉时，不主动给解决方案。',
    '每次最多提出一个容易回答的问题，问题应帮助用户继续表达，而不是审问或连续追问。',
    '不要进行心理诊断，不要制造依赖，也不要暗示只有当前 Agent 能理解或帮助用户。',
  ].join('\n'),
  matchers: {
    keywords: ['倾诉', '陪我聊', '听我说', '难过', '孤独', '委屈', '崩溃', '心里很乱'],
    patterns: [
      /先(?:听|陪)我(?:说|聊)/,
      /(?:不要|别|先别).{0,6}(?:建议|分析|解决)/,
      /我(?:今天|现在|最近)?(?:真的|实在)?(?:很|好)?(?:难过|孤独|委屈|崩溃|心里很乱)/,
      /只想.{0,8}(?:说出来|倾诉|有人听)/,
    ],
  },
}
