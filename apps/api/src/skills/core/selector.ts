import type { CompanionSkillScope } from '@repo/contracts'
import { getPromptSkill, listPromptSkills } from './registry'
import type { PromptSkillDefinition, SelectedPromptSkill } from './types'

const minimumAutomaticScore = 4

function findExplicitSkillId(userText: string) {
  const explicitMatch = userText.match(/(?:^|\s)\/(?:skill\s+)?([a-z][a-z0-9]*(?:-[a-z0-9]+)*)(?=\s|$)/i)
  return explicitMatch?.[1]?.toLowerCase() ?? null
}

function scoreDefinition(definition: PromptSkillDefinition, normalizedUserText: string) {
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

export function selectPromptSkill(params: {
  scope: CompanionSkillScope
  userText: string
  availableSkillIds?: readonly string[]
  availableSkillVersions?: Readonly<Record<string, string>>
}): SelectedPromptSkill | null {
  const normalizedUserText = params.userText.trim().toLowerCase()
  const availableSkillIds = params.availableSkillIds
    ? new Set(params.availableSkillIds)
    : null

  if (!normalizedUserText) {
    return null
  }

  const explicitSkillId = findExplicitSkillId(normalizedUserText)

  if (explicitSkillId) {
    const explicitDefinition = getPromptSkill(
      explicitSkillId,
      params.availableSkillVersions?.[explicitSkillId],
    )

    if (
      explicitDefinition
      && (availableSkillIds
        ? availableSkillIds.has(explicitDefinition.manifest.id)
        : explicitDefinition.manifest.enabledByDefault)
      && explicitDefinition.manifest.scopes.includes(params.scope)
    ) {
      return {
        definition: explicitDefinition,
        selection: {
          skillId: explicitDefinition.manifest.id,
          skillVersion: explicitDefinition.manifest.version,
          skillKind: 'prompt',
          trigger: 'explicit',
          score: 100,
          reason: `用户通过 /${explicitSkillId} 显式启用`,
        },
      }
    }
  }

  const candidates = listPromptSkills(params.scope)
    .map((definition) => getPromptSkill(
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
      skillKind: 'prompt',
      trigger: 'rule',
      score: selected.score,
      reason: `命中 ${selected.matchedPatterns} 个语义模式和 ${selected.matchedKeywords} 个关键词`,
    },
  }
}
