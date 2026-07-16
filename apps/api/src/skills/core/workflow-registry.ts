import { CompanionSkillManifestSchema, type CompanionSkillScope } from '@repo/contracts'
import { longTermGoalPlanningSkill } from '../builtin/long-term-goal-planning'
import type { WorkflowSkillDefinition } from './types'

const workflowSkillDefinitions = [
  longTermGoalPlanningSkill,
]

const workflowSkillVersionRegistry = new Map<string, Map<string, WorkflowSkillDefinition>>()

function compareVersions(left: string, right: string) {
  const leftParts = left.split('.').map(Number)
  const rightParts = right.split('.').map(Number)

  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)

    if (difference !== 0) {
      return difference
    }
  }

  return 0
}

for (const definition of workflowSkillDefinitions) {
  const manifest = CompanionSkillManifestSchema.parse(definition.manifest)

  if (manifest.kind !== 'workflow') {
    throw new Error(`Workflow Skill ${manifest.id} must use the workflow kind`)
  }

  const versions = workflowSkillVersionRegistry.get(manifest.id) ?? new Map<string, WorkflowSkillDefinition>()

  if (versions.has(manifest.version)) {
    throw new Error(`Duplicate Workflow Skill version: ${manifest.id}@${manifest.version}`)
  }

  versions.set(manifest.version, {
    ...definition,
    manifest: {
      ...manifest,
      kind: 'workflow',
    },
  })
  workflowSkillVersionRegistry.set(manifest.id, versions)
}

export function getWorkflowSkill(skillId: string, version?: string | null) {
  const versions = workflowSkillVersionRegistry.get(skillId)

  if (!versions) {
    return null
  }

  if (version) {
    return versions.get(version) ?? null
  }

  return [...versions.values()]
    .sort((left, right) => compareVersions(right.manifest.version, left.manifest.version))[0] ?? null
}

export function listRegisteredWorkflowSkills() {
  return [...workflowSkillVersionRegistry.keys()]
    .map((skillId) => getWorkflowSkill(skillId))
    .filter((definition): definition is WorkflowSkillDefinition => Boolean(definition))
}

export function listWorkflowSkills(scope: CompanionSkillScope) {
  return listRegisteredWorkflowSkills()
    .filter((definition) => definition.manifest.scopes.includes(scope))
}
