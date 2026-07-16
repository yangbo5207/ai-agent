import type { WorkflowSkillDefinition } from '../../core/types'
import {
  createLongTermGoalPlanningState,
  parseLongTermGoalPlanningState,
  runLongTermGoalPlanningTurn,
} from './workflow'

const dayMs = 24 * 60 * 60 * 1000

export const longTermGoalPlanningSkill: WorkflowSkillDefinition = {
  manifest: {
    id: 'long-term-goal-planning',
    version: '1.0.0',
    name: '长期目标规划',
    description: '通过多轮对话确认目标、周期、约束和完成标准，再形成可持续推进的阶段计划。',
    kind: 'workflow',
    scopes: ['single_chat'],
    triggerExamples: [
      '帮我规划未来三个月的学习目标。',
      '我想认真做一个半年的长期计划。',
      '陪我一步步梳理今年的目标和行动。',
    ],
    priority: 85,
    enabledByDefault: true,
  },
  sessionTtlMs: 14 * dayMs,
  initialStep: 'collect_goal',
  matchers: {
    keywords: ['长期目标', '长期规划', '三个月计划', '半年计划', '年度目标', '阶段规划'],
    patterns: [
      /(?:未来|接下来).{0,8}(?:三|六|3|6|十二|12)个?月.{0,12}(?:目标|计划|规划)/,
      /(?:长期|年度|半年).{0,8}(?:目标|计划|规划)/,
      /帮我.{0,8}(?:规划|梳理|制定).{0,12}(?:长期|未来|半年|年度).{0,8}(?:目标|计划)/,
      /陪我.{0,8}(?:一步步|分阶段).{0,12}(?:规划|梳理).{0,8}(?:目标|计划)/,
    ],
  },
  createInitialState: createLongTermGoalPlanningState,
  parseState: parseLongTermGoalPlanningState,
  runTurn: runLongTermGoalPlanningTurn,
}
