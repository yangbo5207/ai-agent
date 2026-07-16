import type { PromptSkillDefinition } from '../../core/types'

export const groupRoundtableSkill: PromptSkillDefinition = {
  manifest: {
    id: 'group-roundtable',
    version: '1.0.0',
    name: '群聊圆桌',
    description: '让群内多个 Agent 从各自角色视角提供互补观点，减少重复和抢话。',
    kind: 'prompt',
    scopes: ['group_chat'],
    triggerExamples: [
      '大家分别怎么看这件事？',
      '你们从不同角度帮我讨论一下。',
      '想听听群里每个人的意见。',
    ],
    priority: 90,
    enabledByDefault: true,
  },
  instructions: [
    '只贡献与你当前角色最匹配、且相对其他成员更有区分度的一个视角。',
    '先直接给观点，再用一到两个理由支撑；不要完整复述用户问题或预演其他成员的回答。',
    '如果最近已有其他 Agent 回答，承接其中有价值的部分并补充新信息，避免同义重复。',
    '保持群聊感和角色语气，可以自然提及其他成员的观点，但不要替他们下结论。',
    '除非用户明确要求详细方案，否则控制篇幅，让不同成员都有清晰的表达空间。',
  ].join('\n'),
  matchers: {
    keywords: ['大家', '你们', '分别', '每个人', '不同角度', '一起讨论', '各自', '群里'],
    patterns: [
      /(?:大家|你们|群里).{0,10}(?:怎么看|什么意见|讨论|分析)/,
      /(?:分别|各自|每个人).{0,10}(?:说说|回答|分析|给意见)/,
      /从.{0,6}(?:不同|多个|各自).{0,6}(?:角度|视角)/,
      /想听.{0,10}(?:大家|你们|每个人).{0,6}(?:意见|看法)/,
    ],
  },
}
