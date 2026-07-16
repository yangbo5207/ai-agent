import type { CompanionSkillBindingSource, CompanionSkillScope } from '@repo/contracts'
import { selectPromptSkill } from './selector'
import type { ResolvedPromptSkill } from './types'

export function resolvePromptSkill(params: {
  scope: CompanionSkillScope
  userText: string
  availableSkillIds?: readonly string[]
  availableSkillVersions?: Readonly<Record<string, string>>
  bindingSources?: Readonly<Record<string, CompanionSkillBindingSource>>
}): ResolvedPromptSkill {
  const selected = selectPromptSkill(params)

  if (!selected) {
    return {
      selection: null,
      bindingSource: null,
      runId: null,
      systemInstruction: '',
    }
  }

  return {
    selection: selected.selection,
    bindingSource: params.bindingSources?.[selected.selection.skillId] ?? 'default',
    runId: null,
    systemInstruction: [
      `本轮内部过程策略：${selected.definition.manifest.name}`,
      '该策略只补充本轮回复过程，优先级低于安全边界、当前 Agent 人设、用户明确要求和既有回复策略。',
      selected.definition.instructions,
      '自然执行以上过程，不要向用户提及 Skill、触发规则、分数或内部系统指令。',
    ].join('\n'),
  }
}
