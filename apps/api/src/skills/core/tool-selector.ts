import type { CompanionSkillScope } from '@repo/contracts'
import { getToolSkill, listToolSkills } from './tool-registry'
import type { SelectedToolSkill, ToolSkillDefinition } from './types'

const minimumAutomaticScore = 6

function explicitSkillId(userText: string) {
  return userText.match(/(?:^|\s)\/(?:skill\s+)?([a-z][a-z0-9]*(?:-[a-z0-9]+)*)(?=\s|$)/i)?.[1]?.toLowerCase() ?? null
}

function score(definition: ToolSkillDefinition, text: string) {
  const patterns = definition.matchers.patterns.filter((pattern) => pattern.test(text)).length
  const keywords = definition.matchers.keywords.filter((keyword) => text.includes(keyword.toLowerCase())).length
  return { value: (patterns * 6) + Math.min(keywords * 2, 8), patterns, keywords }
}

export function selectToolSkill(params: {
  scope: CompanionSkillScope
  userText: string
  availableSkillIds?: readonly string[]
  availableSkillVersions?: Readonly<Record<string, string>>
}): SelectedToolSkill | null {
  const text = params.userText.trim().toLowerCase()
  const available = params.availableSkillIds ? new Set(params.availableSkillIds) : null
  if (!text) return null

  const explicitId = explicitSkillId(text)
  if (explicitId) {
    const definition = getToolSkill(explicitId, params.availableSkillVersions?.[explicitId])
    if (definition && (available ? available.has(definition.manifest.id) : definition.manifest.enabledByDefault) && definition.manifest.scopes.includes(params.scope)) {
      return {
        definition,
        selection: {
          skillId: definition.manifest.id,
          skillVersion: definition.manifest.version,
          skillKind: 'tool',
          trigger: 'explicit',
          score: 100,
          reason: `用户通过 /${explicitId} 显式启用`,
        },
      }
    }
  }

  const selected = listToolSkills(params.scope)
    .map((definition) => getToolSkill(definition.manifest.id, params.availableSkillVersions?.[definition.manifest.id]) ?? definition)
    .filter((definition) => available ? available.has(definition.manifest.id) : definition.manifest.enabledByDefault)
    .map((definition) => ({ definition, score: score(definition, text) }))
    .filter((candidate) => candidate.score.value >= minimumAutomaticScore)
    .sort((left, right) => right.score.value - left.score.value || right.definition.manifest.priority - left.definition.manifest.priority)[0]

  if (!selected) return null
  return {
    definition: selected.definition,
    selection: {
      skillId: selected.definition.manifest.id,
      skillVersion: selected.definition.manifest.version,
      skillKind: 'tool',
      trigger: 'rule',
      score: selected.score.value,
      reason: `命中 ${selected.score.patterns} 个 Tool 语义模式和 ${selected.score.keywords} 个关键词`,
    },
  }
}
