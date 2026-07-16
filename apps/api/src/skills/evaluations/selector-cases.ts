import type { CompanionSkillScope } from '@repo/contracts'

export type PromptSkillSelectorCase = {
  name: string
  scope: CompanionSkillScope
  userText: string
  expectedSkillId: string | null
  availableSkillIds?: readonly string[]
}

export const promptSkillSelectorCases: readonly PromptSkillSelectorCase[] = [
  {
    name: 'explicit active listening',
    scope: 'single_chat',
    userText: '/active-listening 我想把今天发生的事情说出来。',
    expectedSkillId: 'active-listening',
  },
  {
    name: 'explicit skill command',
    scope: 'single_chat',
    userText: '/skill decision-clarifier 帮我看看要不要换工作。',
    expectedSkillId: 'decision-clarifier',
  },
  {
    name: 'explicit unavailable skill',
    scope: 'single_chat',
    userText: '/goal-breakdown 帮我制定计划。',
    expectedSkillId: null,
    availableSkillIds: ['active-listening', 'decision-clarifier'],
  },
  {
    name: 'group skill blocked in single chat',
    scope: 'single_chat',
    userText: '/group-roundtable 大家分别说说看法。',
    expectedSkillId: null,
  },
  {
    name: 'listen before advice',
    scope: 'single_chat',
    userText: '你先听我说，别急着给建议。',
    expectedSkillId: 'active-listening',
  },
  {
    name: 'clear emotional disclosure',
    scope: 'single_chat',
    userText: '我今天真的很难过，想找个人说说。',
    expectedSkillId: 'active-listening',
  },
  {
    name: 'only wants to vent',
    scope: 'group_chat',
    userText: '我只想倾诉一下，有人听就好。',
    expectedSkillId: 'active-listening',
  },
  {
    name: 'uncertain between options',
    scope: 'single_chat',
    userText: '两个工作机会我都喜欢，不知道怎么选。',
    expectedSkillId: 'decision-clarifier',
  },
  {
    name: 'compare pros and cons',
    scope: 'single_chat',
    userText: '帮我比较一下这两个方案的利弊。',
    expectedSkillId: 'decision-clarifier',
  },
  {
    name: 'worth continuing',
    scope: 'group_chat',
    userText: '这件事情值不值得继续投入？',
    expectedSkillId: 'decision-clarifier',
  },
  {
    name: 'create a plan',
    scope: 'single_chat',
    userText: '帮我制定一个三个月的学习计划。',
    expectedSkillId: 'goal-breakdown',
  },
  {
    name: 'does not know where to start',
    scope: 'single_chat',
    userText: '事情太多了，我完全不知道从哪里开始。',
    expectedSkillId: 'goal-breakdown',
  },
  {
    name: 'goal feels impossible to start',
    scope: 'group_chat',
    userText: '我想跑一次马拉松，可是现在无从下手。',
    expectedSkillId: 'goal-breakdown',
  },
  {
    name: 'ask group opinion',
    scope: 'group_chat',
    userText: '大家怎么看这个决定？',
    expectedSkillId: 'group-roundtable',
  },
  {
    name: 'ask for distinct angles',
    scope: 'group_chat',
    userText: '请你们从不同角度分析一下。',
    expectedSkillId: 'group-roundtable',
  },
  {
    name: 'ask each member',
    scope: 'group_chat',
    userText: '每个人分别说说自己的意见。',
    expectedSkillId: 'group-roundtable',
  },
  {
    name: 'ordinary small talk',
    scope: 'single_chat',
    userText: '我今天中午吃了一碗面。',
    expectedSkillId: null,
  },
  {
    name: 'single weak plan keyword',
    scope: 'single_chat',
    userText: '这个计划听起来挺好的。',
    expectedSkillId: null,
  },
  {
    name: 'single weak decision keyword',
    scope: 'single_chat',
    userText: '我决定晚上早点睡。',
    expectedSkillId: null,
  },
  {
    name: 'group word without roundtable request',
    scope: 'group_chat',
    userText: '大家今天都吃什么了？',
    expectedSkillId: null,
  },
  {
    name: 'empty input',
    scope: 'single_chat',
    userText: '   ',
    expectedSkillId: null,
  },
]
