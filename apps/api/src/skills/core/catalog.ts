import type { CompanionSkillScope } from '@repo/contracts'
import type { BackgroundSkillDefinition, PromptSkillDefinition, ToolSkillDefinition, WorkflowSkillDefinition } from './types'
import { getBackgroundSkill, listRegisteredBackgroundSkills } from './background-registry'
import { getPromptSkill, listPromptSkills, listRegisteredPromptSkills } from './registry'
import { getToolSkill, listRegisteredToolSkills, listToolSkills } from './tool-registry'
import { getWorkflowSkill, listRegisteredWorkflowSkills, listWorkflowSkills } from './workflow-registry'

export type RegisteredSkillDefinition = PromptSkillDefinition | WorkflowSkillDefinition | ToolSkillDefinition | BackgroundSkillDefinition

const currentDefinitions = [
  ...listRegisteredPromptSkills(),
  ...listRegisteredWorkflowSkills(),
  ...listRegisteredToolSkills(),
  ...listRegisteredBackgroundSkills(),
]
const definitionIds = new Set<string>()

for (const definition of currentDefinitions) {
  if (definitionIds.has(definition.manifest.id)) {
    throw new Error(`Duplicate Skill id across runtime kinds: ${definition.manifest.id}`)
  }

  definitionIds.add(definition.manifest.id)
}

export function getRegisteredSkill(skillId: string, version?: string | null) {
  return getPromptSkill(skillId, version)
    ?? getWorkflowSkill(skillId, version)
    ?? getToolSkill(skillId, version)
    ?? getBackgroundSkill(skillId, version)
}

export function listRegisteredSkills(): RegisteredSkillDefinition[] {
  return [
    ...listRegisteredPromptSkills(),
    ...listRegisteredWorkflowSkills(),
    ...listRegisteredToolSkills(),
    ...listRegisteredBackgroundSkills(),
  ]
}

export function listSkills(scope: CompanionSkillScope): RegisteredSkillDefinition[] {
  return [
    ...listPromptSkills(scope),
    ...listWorkflowSkills(scope),
    ...listToolSkills(scope),
    ...listRegisteredBackgroundSkills().filter((definition) => definition.manifest.scopes.includes(scope)),
  ]
}
