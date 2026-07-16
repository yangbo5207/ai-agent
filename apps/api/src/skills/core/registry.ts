import { CompanionSkillManifestSchema, type CompanionSkillScope } from '@repo/contracts'
import { activeListeningSkill } from '../builtin/active-listening'
import { decisionClarifierSkill } from '../builtin/decision-clarifier'
import { goalBreakdownSkill } from '../builtin/goal-breakdown'
import { groupRoundtableSkill } from '../builtin/group-roundtable'
import type { PromptSkillDefinition } from './types'

const promptSkillDefinitions = [
  activeListeningSkill,
  decisionClarifierSkill,
  goalBreakdownSkill,
  groupRoundtableSkill,
]

const promptSkillVersionRegistry = new Map<string, Map<string, PromptSkillDefinition>>()

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

for (const definition of promptSkillDefinitions) {
  const manifest = CompanionSkillManifestSchema.parse(definition.manifest)

  if (manifest.kind !== 'prompt') {
    throw new Error(`Prompt Skill ${manifest.id} must use the prompt kind`)
  }

  const versionRegistry = promptSkillVersionRegistry.get(manifest.id) ?? new Map<string, PromptSkillDefinition>()

  if (versionRegistry.has(manifest.version)) {
    throw new Error(`Duplicate Prompt Skill version: ${manifest.id}@${manifest.version}`)
  }

  versionRegistry.set(manifest.version, {
    ...definition,
    manifest: {
      ...manifest,
      kind: 'prompt',
    },
  })
  promptSkillVersionRegistry.set(manifest.id, versionRegistry)
}

export function getPromptSkill(skillId: string, version?: string | null) {
  const versionRegistry = promptSkillVersionRegistry.get(skillId)

  if (!versionRegistry) {
    return null
  }

  if (version) {
    return versionRegistry.get(version) ?? null
  }

  return [...versionRegistry.values()]
    .sort((left, right) => compareVersions(right.manifest.version, left.manifest.version))[0] ?? null
}

export function listRegisteredPromptSkills() {
  return [...promptSkillVersionRegistry.keys()]
    .map((skillId) => getPromptSkill(skillId))
    .filter((definition): definition is PromptSkillDefinition => Boolean(definition))
}

export function listPromptSkillVersions(skillId: string) {
  return [...(promptSkillVersionRegistry.get(skillId)?.values() ?? [])]
    .sort((left, right) => compareVersions(right.manifest.version, left.manifest.version))
}

export function listPromptSkills(scope: CompanionSkillScope) {
  return listRegisteredPromptSkills()
    .filter((definition) => definition.manifest.scopes.includes(scope))
}
