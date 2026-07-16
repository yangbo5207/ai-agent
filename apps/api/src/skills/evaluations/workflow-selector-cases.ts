import type { CompanionSkillScope } from '@repo/contracts'

export type WorkflowSkillSelectorCase = {
  name: string
  scope: CompanionSkillScope
  userText: string
  expectedSkillId: string | null
  availableSkillIds?: readonly string[]
}

export const workflowSkillSelectorCases: readonly WorkflowSkillSelectorCase[] = [
  {
    name: 'explicit long-term planning',
    scope: 'single_chat',
    userText: '/long-term-goal-planning 我想规划未来三个月的学习。',
    expectedSkillId: 'long-term-goal-planning',
  },
  {
    name: 'explicit unavailable workflow',
    scope: 'single_chat',
    userText: '/long-term-goal-planning 帮我规划半年目标。',
    expectedSkillId: null,
    availableSkillIds: [],
  },
  {
    name: 'three month goal',
    scope: 'single_chat',
    userText: '帮我规划未来三个月的英语学习目标。',
    expectedSkillId: 'long-term-goal-planning',
  },
  {
    name: 'annual planning',
    scope: 'single_chat',
    userText: '我想认真梳理一下年度目标和计划。',
    expectedSkillId: 'long-term-goal-planning',
  },
  {
    name: 'guided staged planning',
    scope: 'single_chat',
    userText: '陪我一步步规划一个半年的长期目标。',
    expectedSkillId: 'long-term-goal-planning',
  },
  {
    name: 'ordinary short plan stays prompt only',
    scope: 'single_chat',
    userText: '帮我安排一下明天的学习计划。',
    expectedSkillId: null,
  },
  {
    name: 'workflow unavailable in group',
    scope: 'group_chat',
    userText: '/long-term-goal-planning 帮我规划长期目标。',
    expectedSkillId: null,
  },
]
