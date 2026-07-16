import type { CompanionSkillScope } from '@repo/contracts'
import type { SelectedWorkflowSkill, WorkflowSkillDefinition } from './types'
import { getWorkflowSkill, listWorkflowSkills } from './workflow-registry'

const minimumAutomaticScore = 6

function findExplicitSkillId(userText: string) {
  const explicitMatch = userText.match(/(?:^|\s)\/(?:skill\s+)?([a-z][a-z0-9]*(?:-[a-z0-9]+)*)(?=\s|$)/i)
  return explicitMatch?.[1]?.toLowerCase() ?? null
}

function scoreDefinition(definition: WorkflowSkillDefinition, normalizedUserText: string) {
  const matchedPatterns = definition.matchers.patterns
    .filter((pattern) => pattern.test(normalizedUserText))
    .length
  const matchedKeywords = definition.matchers.keywords
    .filter((keyword) => normalizedUserText.includes(keyword.toLowerCase()))
    .length

  return {
    score: (matchedPatterns * 6) + Math.min(matchedKeywords * 2, 8),
    matchedPatterns,
    matchedKeywords,
  }
}

export function selectWorkflowSkill(params: {
  scope: CompanionSkillScope
  userText: string
  availableSkillIds?: readonly string[]
  availableSkillVersions?: Readonly<Record<string, string>>
}): SelectedWorkflowSkill | null {
  const normalizedUserText = params.userText.trim().toLowerCase()
  const availableSkillIds = params.availableSkillIds
    ? new Set(params.availableSkillIds)
    : null

  if (!normalizedUserText) {
    return null
  }

  const explicitSkillId = findExplicitSkillId(normalizedUserText)

  if (explicitSkillId) {
    const definition = getWorkflowSkill(
      explicitSkillId,
      params.availableSkillVersions?.[explicitSkillId],
    )

    if (
      definition
      && (availableSkillIds
        ? availableSkillIds.has(definition.manifest.id)
        : definition.manifest.enabledByDefault)
      && definition.manifest.scopes.includes(params.scope)
    ) {
      return {
        definition,
        selection: {
          skillId: definition.manifest.id,
          skillVersion: definition.manifest.version,
          skillKind: 'workflow',
          trigger: 'explicit',
          score: 100,
          reason: `用户通过 /${explicitSkillId} 显式启用`,
        },
      }
    }
  }

  const candidates = listWorkflowSkills(params.scope)
    .map((definition) => getWorkflowSkill(
      definition.manifest.id,
      params.availableSkillVersions?.[definition.manifest.id],
    ) ?? definition)
    .filter((definition) => availableSkillIds
      ? availableSkillIds.has(definition.manifest.id)
      : definition.manifest.enabledByDefault)
    .map((definition) => ({
      definition,
      ...scoreDefinition(definition, normalizedUserText),
    }))
    .filter((candidate) => candidate.score >= minimumAutomaticScore)
    .sort((left, right) => (
      right.score - left.score
      || right.definition.manifest.priority - left.definition.manifest.priority
      || left.definition.manifest.id.localeCompare(right.definition.manifest.id)
    ))

  const selected = candidates[0]

  if (!selected) {
    return null
  }

  return {
    definition: selected.definition,
    selection: {
      skillId: selected.definition.manifest.id,
      skillVersion: selected.definition.manifest.version,
      skillKind: 'workflow',
      trigger: 'rule',
      score: selected.score,
      reason: `命中 ${selected.matchedPatterns} 个 Workflow 语义模式和 ${selected.matchedKeywords} 个关键词`,
    },
  }
}
