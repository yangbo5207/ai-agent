import { CompanionSkillManifestSchema } from '@repo/contracts'
import { goalCheckInReminderSkill } from '../builtin/goal-check-in-reminder'
import type { BackgroundSkillDefinition } from './types'

const definitions = [goalCheckInReminderSkill]
const registry = new Map<string, Map<string, BackgroundSkillDefinition>>()

for (const definition of definitions) {
  const manifest = CompanionSkillManifestSchema.parse(definition.manifest)
  if (manifest.kind !== 'background') throw new Error(`Background Skill ${manifest.id} must use the background kind`)
  const versions = registry.get(manifest.id) ?? new Map<string, BackgroundSkillDefinition>()
  if (versions.has(manifest.version)) throw new Error(`Duplicate Background Skill version: ${manifest.id}@${manifest.version}`)
  versions.set(manifest.version, { ...definition, manifest: { ...manifest, kind: 'background' } })
  registry.set(manifest.id, versions)
}

export function getBackgroundSkill(skillId: string, version?: string | null) {
  const versions = registry.get(skillId)
  if (!versions) return null
  if (version) return versions.get(version) ?? null
  return [...versions.values()].sort((left, right) => right.manifest.version.localeCompare(left.manifest.version, undefined, { numeric: true }))[0] ?? null
}

export function listRegisteredBackgroundSkills() {
  return [...registry.keys()]
    .map((skillId) => getBackgroundSkill(skillId))
    .filter((definition): definition is BackgroundSkillDefinition => Boolean(definition))
}
