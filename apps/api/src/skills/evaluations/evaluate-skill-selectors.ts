import { selectWorkflowSkill } from '../core/workflow-selector'
import { evaluatePromptSkillSelector } from './evaluate-selector'
import { workflowSkillSelectorCases } from './workflow-selector-cases'
import { evaluateLongTermGoalPlanningWorkflow } from './evaluate-long-term-goal-planning'
import { evaluateControlledSkills } from './evaluate-controlled-skills'

export async function evaluateSkillSelectors() {
  const promptEvaluation = evaluatePromptSkillSelector()
  const workflowResults = workflowSkillSelectorCases.map((testCase) => {
    const selected = selectWorkflowSkill({
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
  const workflowTurnResults = await evaluateLongTermGoalPlanningWorkflow()
  const controlledSkillResults = evaluateControlledSkills()
  const results = [...promptEvaluation.results, ...workflowResults, ...workflowTurnResults, ...controlledSkillResults]
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
