import { CompanionSkillManifestSchema, type CompanionSkillScope } from '@repo/contracts'
import { memoryRecallSkill } from '../builtin/memory-recall'
import type { ToolSkillDefinition } from './types'

const toolSkillDefinitions = [memoryRecallSkill]
const registry = new Map<string, Map<string, ToolSkillDefinition>>()

function compareVersions(left: string, right: string) {
  return left.localeCompare(right, undefined, { numeric: true })
}

for (const definition of toolSkillDefinitions) {
  const manifest = CompanionSkillManifestSchema.parse(definition.manifest)

  if (manifest.kind !== 'tool') {
    throw new Error(`Tool Skill ${manifest.id} must use the tool kind`)
  }

  if (!Number.isInteger(definition.maxCallsPerTurn) || definition.maxCallsPerTurn < 1 || definition.maxCallsPerTurn > 4) {
    throw new Error(`Tool Skill ${manifest.id} must set maxCallsPerTurn between 1 and 4`)
  }

  if (!Number.isInteger(definition.timeoutMs) || definition.timeoutMs < 100 || definition.timeoutMs > 30_000) {
    throw new Error(`Tool Skill ${manifest.id} must set timeoutMs between 100 and 30000`)
  }

  const versions = registry.get(manifest.id) ?? new Map<string, ToolSkillDefinition>()

  if (versions.has(manifest.version)) {
    throw new Error(`Duplicate Tool Skill version: ${manifest.id}@${manifest.version}`)
  }

  versions.set(manifest.version, { ...definition, manifest: { ...manifest, kind: 'tool' } })
  registry.set(manifest.id, versions)
}

export function getToolSkill(skillId: string, version?: string | null) {
  const versions = registry.get(skillId)
  if (!versions) return null
  if (version) return versions.get(version) ?? null
  return [...versions.values()].sort((left, right) => compareVersions(right.manifest.version, left.manifest.version))[0] ?? null
}

export function listRegisteredToolSkills() {
  return [...registry.keys()]
    .map((skillId) => getToolSkill(skillId))
    .filter((definition): definition is ToolSkillDefinition => Boolean(definition))
}

export function listToolSkills(scope: CompanionSkillScope) {
  return listRegisteredToolSkills().filter((definition) => definition.manifest.scopes.includes(scope))
}
