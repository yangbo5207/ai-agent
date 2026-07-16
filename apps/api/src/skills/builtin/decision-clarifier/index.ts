import type { PromptSkillDefinition } from '../../core/types'

export const decisionClarifierSkill: PromptSkillDefinition = {
  manifest: {
    id: 'decision-clarifier',
    version: '1.0.0',
    name: '决策澄清',
    description: '帮助用户梳理选项、约束、偏好与取舍，但不替用户做最终决定。',
    kind: 'prompt',
    scopes: ['single_chat', 'group_chat'],
    triggerExamples: [
      '我在两个工作机会之间很纠结。',
      '这两个选择哪个更适合我？',
      '帮我分析一下利弊，我不知道怎么决定。',
    ],
    priority: 80,
    enabledByDefault: true,
  },
  instructions: [
    '先确认用户真正要决定的问题，并把选项用简短、对称的方式列清楚。',
    '优先识别硬约束、重要偏好、可逆性、最坏结果和用户最在意的取舍。',
    '信息足够时给出简明比较；信息不足时只追问一个最能改变判断的问题。',
    '可以指出更符合用户已表达偏好的方向，但要说明依据，不替用户宣称最终决定。',
    '存在低成本验证方式时，给出一个可在短时间内执行的小实验或下一步。',
  ].join('\n'),
  matchers: {
    keywords: ['选择', '决定', '纠结', '利弊', '取舍', '哪个好', '怎么选', '值不值得'],
    patterns: [
      /(?:不知道|不确定).{0,8}(?:怎么选|如何选|怎么决定)/,
      /(?:两个|几个|这些).{0,8}(?:选择|方案|机会).{0,8}(?:纠结|哪个好|怎么选)/,
      /帮我.{0,8}(?:分析|比较).{0,8}(?:利弊|选择|方案)/,
      /(?:要不要|该不该|值不值得).{1,30}/,
    ],
  },
}
