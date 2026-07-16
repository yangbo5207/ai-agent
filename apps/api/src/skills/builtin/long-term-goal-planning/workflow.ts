import { Annotation, END, START, StateGraph } from '@langchain/langgraph'
import { z } from 'zod'
import type { WorkflowSkillTurnOutput } from '../../core/types'

const GoalPlanningStepSchema = z.enum([
  'collect_goal',
  'collect_horizon',
  'collect_constraints',
  'collect_success_criteria',
  'build_plan',
])

export const LongTermGoalPlanningStateSchema = z.object({
  goal: z.string().trim().min(1).max(4000).nullable(),
  horizon: z.string().trim().min(1).max(300).nullable(),
  constraints: z.string().trim().min(1).max(2000).nullable(),
  successCriteria: z.string().trim().min(1).max(1200).nullable(),
  currentStep: GoalPlanningStepSchema,
})

export type LongTermGoalPlanningState = z.infer<typeof LongTermGoalPlanningStateSchema>

const GoalPlanningGraphState = Annotation.Root({
  workflowState: Annotation<LongTermGoalPlanningState>(),
  userText: Annotation<string>(),
  isNewSession: Annotation<boolean>(),
  output: Annotation<WorkflowSkillTurnOutput | null>(),
})

const explicitCommandPattern = /(?:^|\s)\/(?:skill\s+)?long-term-goal-planning(?=\s|$)/i

function normalizeAnswer(value: string, limit: number) {
  return value
    .replace(explicitCommandPattern, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit)
}

function inferHorizon(value: string) {
  const match = value.match(/(?:未来\s*)?(?:\d+|一|两|二|三|四|五|六|九|十|十二)\s*(?:天|周|个?月|年)|半年|一年/i)
  return match?.[0]?.trim() ?? null
}

function applyUserTurn(params: {
  state: LongTermGoalPlanningState
  userText: string
  isNewSession: boolean
}) {
  const answer = normalizeAnswer(params.userText, 4000)
  const next = { ...params.state }

  if (!answer) {
    return next
  }

  if (params.isNewSession) {
    next.goal = answer
    next.horizon = inferHorizon(answer)
    return next
  }

  switch (params.state.currentStep) {
    case 'collect_goal':
      next.goal = answer
      next.horizon = inferHorizon(answer) ?? next.horizon
      break
    case 'collect_horizon':
      next.horizon = answer.slice(0, 300)
      break
    case 'collect_constraints':
      next.constraints = answer.slice(0, 2000)
      break
    case 'collect_success_criteria':
      next.successCriteria = answer.slice(0, 1200)
      break
    case 'build_plan':
      break
  }

  return next
}

function resolveNextStep(state: LongTermGoalPlanningState): LongTermGoalPlanningState['currentStep'] {
  if (!state.goal) {
    return 'collect_goal'
  }

  if (!state.horizon) {
    return 'collect_horizon'
  }

  if (!state.constraints) {
    return 'collect_constraints'
  }

  if (!state.successCriteria) {
    return 'collect_success_criteria'
  }

  return 'build_plan'
}

function getPendingQuestion(step: LongTermGoalPlanningState['currentStep']) {
  switch (step) {
    case 'collect_goal':
      return '你最想通过这次长期规划实现的具体结果是什么？'
    case 'collect_horizon':
      return '你希望用多长时间完成这个目标？'
    case 'collect_constraints':
      return '目前最需要纳入计划的限制是什么，比如每天可投入时间、预算或精力？'
    case 'collect_success_criteria':
      return '到期时出现什么可观察的结果，才算这个目标完成了？'
    case 'build_plan':
      return null
  }
}

function buildSystemInstruction(state: LongTermGoalPlanningState, pendingQuestion: string | null) {
  const collected = [
    state.goal ? `目标：${state.goal}` : '',
    state.horizon ? `周期：${state.horizon}` : '',
    state.constraints ? `约束：${state.constraints}` : '',
    state.successCriteria ? `完成标准：${state.successCriteria}` : '',
  ].filter(Boolean).join('\n')

  if (pendingQuestion) {
    return [
      '本轮正在执行多轮 Workflow Skill「长期目标规划」。',
      '该 Workflow 只补充任务过程，优先级低于安全边界、当前 Agent 人设和用户明确要求。',
      '已经收集的信息：',
      collected || '暂无。',
      `本轮只需要自然地确认用户刚提供的信息，然后提出这一个问题：${pendingQuestion}`,
      '不要提前生成完整计划，不要连续提出多个问题，不要向用户暴露 Workflow、Session 或内部步骤名称。',
    ].join('\n')
  }

  return [
    '本轮正在完成多轮 Workflow Skill「长期目标规划」。',
    '该 Workflow 只补充任务过程，优先级低于安全边界、当前 Agent 人设和用户明确要求。',
    '请严格基于以下已经确认的信息生成最终计划：',
    collected,
    '输出一份清晰但不过度复杂的长期计划：先概括目标，再给出三到五个阶段里程碑、近期节奏、最小第一步、检查点和主要风险应对。',
    '计划必须尊重用户约束，并用可观察的完成标准收束。不要再追问，不要提及 Workflow、Session 或内部步骤名称。',
  ].join('\n')
}

async function absorbUserTurnNode(state: typeof GoalPlanningGraphState.State) {
  return {
    workflowState: applyUserTurn({
      state: state.workflowState,
      userText: state.userText,
      isNewSession: state.isNewSession,
    }),
  }
}

async function resolveStepNode(state: typeof GoalPlanningGraphState.State) {
  return {
    workflowState: {
      ...state.workflowState,
      currentStep: resolveNextStep(state.workflowState),
    },
  }
}

async function buildOutputNode(state: typeof GoalPlanningGraphState.State) {
  const pendingQuestion = getPendingQuestion(state.workflowState.currentStep)
  const status = state.workflowState.currentStep === 'build_plan'
    ? 'completed' as const
    : 'waiting_user' as const

  return {
    output: {
      state: state.workflowState,
      currentStep: state.workflowState.currentStep,
      status,
      pendingQuestion,
      systemInstruction: buildSystemInstruction(state.workflowState, pendingQuestion),
    },
  }
}

const goalPlanningGraph = new StateGraph(GoalPlanningGraphState)
  .addNode('absorbUserTurn', absorbUserTurnNode)
  .addNode('resolveStep', resolveStepNode)
  .addNode('buildOutput', buildOutputNode)
  .addEdge(START, 'absorbUserTurn')
  .addEdge('absorbUserTurn', 'resolveStep')
  .addEdge('resolveStep', 'buildOutput')
  .addEdge('buildOutput', END)
  .compile()

export function createLongTermGoalPlanningState(): LongTermGoalPlanningState {
  return {
    goal: null,
    horizon: null,
    constraints: null,
    successCriteria: null,
    currentStep: 'collect_goal',
  }
}

export function parseLongTermGoalPlanningState(value: unknown) {
  return LongTermGoalPlanningStateSchema.parse(value)
}

export async function runLongTermGoalPlanningTurn(input: {
  state: unknown
  userText: string
  isNewSession: boolean
}): Promise<WorkflowSkillTurnOutput> {
  const result = await goalPlanningGraph.invoke({
    workflowState: parseLongTermGoalPlanningState(input.state),
    userText: input.userText,
    isNewSession: input.isNewSession,
    output: null,
  })

  if (!result.output) {
    throw new Error('Long-term goal planning workflow did not produce an output')
  }

  return result.output
}
