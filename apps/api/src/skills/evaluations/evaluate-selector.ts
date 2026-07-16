import { selectPromptSkill } from '../core/selector'
import { promptSkillSelectorCases } from './selector-cases'

export function evaluatePromptSkillSelector() {
  const results = promptSkillSelectorCases.map((testCase) => {
    const selected = selectPromptSkill({
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
  const passed = results.filter((result) => result.passed).length
  const total = results.length

  return {
    total,
    passed,
    failed: total - passed,
    passRate: total === 0 ? 1 : passed / total,
    results,
  }
}
