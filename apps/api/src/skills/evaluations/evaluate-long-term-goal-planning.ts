import {
  createLongTermGoalPlanningState,
  runLongTermGoalPlanningTurn,
} from '../builtin/long-term-goal-planning/workflow'

export async function evaluateLongTermGoalPlanningWorkflow() {
  const results: Array<{
    name: string
    expectedSkillId: string
    actualSkillId: string | null
    passed: boolean
  }> = []

  const first = await runLongTermGoalPlanningTurn({
    state: createLongTermGoalPlanningState(),
    userText: '帮我规划未来三个月的英语学习目标。',
    isNewSession: true,
  })
  results.push({
    name: 'workflow infers horizon and asks constraints',
    expectedSkillId: 'collect_constraints',
    actualSkillId: first.currentStep,
    passed: first.currentStep === 'collect_constraints' && first.status === 'waiting_user',
  })

  const second = await runLongTermGoalPlanningTurn({
    state: first.state,
    userText: '工作日每天最多一小时，周末可以多投入一些。',
    isNewSession: false,
  })
  results.push({
    name: 'workflow stores constraints and asks success criteria',
    expectedSkillId: 'collect_success_criteria',
    actualSkillId: second.currentStep,
    passed: second.currentStep === 'collect_success_criteria' && second.status === 'waiting_user',
  })

  const third = await runLongTermGoalPlanningTurn({
    state: second.state,
    userText: '三个月后可以完成一次二十分钟的英文分享。',
    isNewSession: false,
  })
  results.push({
    name: 'workflow completes after success criteria',
    expectedSkillId: 'build_plan',
    actualSkillId: third.currentStep,
    passed: third.currentStep === 'build_plan' && third.status === 'completed',
  })

  const missingHorizon = await runLongTermGoalPlanningTurn({
    state: createLongTermGoalPlanningState(),
    userText: '我想建立稳定阅读习惯。',
    isNewSession: true,
  })
  results.push({
    name: 'workflow asks horizon when missing',
    expectedSkillId: 'collect_horizon',
    actualSkillId: missingHorizon.currentStep,
    passed: missingHorizon.currentStep === 'collect_horizon' && missingHorizon.status === 'waiting_user',
  })

  return results
}
