import type { CompanionSkillScope } from '@repo/contracts'

export type ToolSkillSelectorCase = {
  name: string
  scope: CompanionSkillScope
  userText: string
  expectedSkillId: string | null
  availableSkillIds?: readonly string[]
}

export const toolSkillSelectorCases: readonly ToolSkillSelectorCase[] = [
  {
    name: 'explicit memory recall',
    scope: 'single_chat',
    userText: '/memory-recall 上次说过的旅行计划是什么？',
    expectedSkillId: 'memory-recall',
  },
  {
    name: 'semantic memory recall',
    scope: 'single_chat',
    userText: '你还记得之前我说过最喜欢哪种咖啡吗？',
    expectedSkillId: 'memory-recall',
  },
  {
    name: 'memory recall unavailable when disabled',
    scope: 'single_chat',
    userText: '从我们的记忆里找一下上次的书单。',
    expectedSkillId: null,
    availableSkillIds: [],
  },
  {
    name: 'memory recall unavailable in group',
    scope: 'group_chat',
    userText: '/memory-recall 找一下之前的计划。',
    expectedSkillId: null,
  },
  {
    name: 'ordinary question does not invoke memory tool',
    scope: 'single_chat',
    userText: '今天适合去哪里散步？',
    expectedSkillId: null,
  },
]
