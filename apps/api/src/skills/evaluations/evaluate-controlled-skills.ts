import { goalCheckInPayloadSchema } from '../builtin/goal-check-in-reminder'
import { selectToolSkill } from '../core/tool-selector'
import { toolSkillSelectorCases } from './tool-selector-cases'

export function evaluateControlledSkills() {
  const selectorResults = toolSkillSelectorCases.map((testCase) => {
    const selected = selectToolSkill({
      scope: testCase.scope,
      userText: testCase.userText,
      availableSkillIds: testCase.availableSkillIds,
    })
    const actualSkillId = selected?.selection.skillId ?? null
    return {
      name: testCase.name,
      expectedSkillId: testCase.expectedSkillId,
      actualSkillId,
      passed: actualSkillId === testCase.expectedSkillId,
    }
  })
  const validPayload = goalCheckInPayloadSchema.safeParse({
    agentId: 'agent-1',
    agentName: '小北',
    conversationId: 'conversation-1',
    note: '复盘本周写作目标',
  })
  const invalidPayload = goalCheckInPayloadSchema.safeParse({
    agentId: '',
    agentName: '小北',
    conversationId: 'conversation-1',
    note: null,
  })

  return [
    ...selectorResults,
    {
      name: 'background payload accepts controlled fields',
      expectedSkillId: 'valid',
      actualSkillId: validPayload.success ? 'valid' : 'invalid',
      passed: validPayload.success,
    },
    {
      name: 'background payload rejects missing agent id',
      expectedSkillId: 'invalid',
      actualSkillId: invalidPayload.success ? 'valid' : 'invalid',
      passed: !invalidPayload.success,
    },
  ]
}
