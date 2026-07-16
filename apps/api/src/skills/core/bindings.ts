import type {
  CompanionSkillBindingScopeType,
  CompanionSkillBindingSource,
  CompanionSkillCatalogItem,
  CompanionSkillScope,
} from '@repo/contracts'
import type { SkillBindingRecord } from '../repository'
import { getRegisteredSkill, listRegisteredSkills, listSkills } from './catalog'
import { getPromptSkill, listPromptSkills } from './registry'
import { getToolSkill, listToolSkills } from './tool-registry'
import { getWorkflowSkill, listWorkflowSkills } from './workflow-registry'

export type ResolvedSkillBindingTarget = {
  scopeType: CompanionSkillBindingScopeType
  scopeId: string
}

export function findEffectiveBinding(params: {
  bindings: readonly SkillBindingRecord[]
  targets: readonly ResolvedSkillBindingTarget[]
  skillId: string
}) {
  for (const target of params.targets) {
    const binding = params.bindings.find((candidate) => (
      candidate.skillId === params.skillId
      && candidate.scopeType === target.scopeType
      && candidate.scopeId === target.scopeId
    ))

    if (binding) {
      return binding
    }
  }

  return null
}

function resolveAvailability(params: {
  definitions: ReturnType<typeof listSkills>
  bindings: readonly SkillBindingRecord[]
  targets: readonly ResolvedSkillBindingTarget[]
  getDefinition: typeof getRegisteredSkill
}) {
  const availableSkillIds: string[] = []
  const availableSkillVersions: Record<string, string> = {}
  const bindingSources: Record<string, CompanionSkillBindingSource> = {}

  for (const definition of params.definitions) {
    const binding = findEffectiveBinding({
      bindings: params.bindings,
      targets: params.targets,
      skillId: definition.manifest.id,
    })
    const effectiveDefinition = binding?.skillVersion
      ? params.getDefinition(definition.manifest.id, binding.skillVersion)
      : definition
    const enabled = Boolean(effectiveDefinition) && (binding?.enabled ?? definition.manifest.enabledByDefault)

    if (enabled && effectiveDefinition) {
      availableSkillIds.push(definition.manifest.id)
      availableSkillVersions[definition.manifest.id] = effectiveDefinition.manifest.version
    }

    bindingSources[definition.manifest.id] = binding?.scopeType ?? 'default'
  }

  return {
    availableSkillIds,
    availableSkillVersions,
    bindingSources,
  }
}

export function resolvePromptSkillAvailability(params: {
  scope: CompanionSkillScope
  bindings: readonly SkillBindingRecord[]
  targets: readonly ResolvedSkillBindingTarget[]
}) {
  return resolveAvailability({
    definitions: listPromptSkills(params.scope),
    bindings: params.bindings,
    targets: params.targets,
    getDefinition: getPromptSkill,
  })
}

export function resolveWorkflowSkillAvailability(params: {
  scope: CompanionSkillScope
  bindings: readonly SkillBindingRecord[]
  targets: readonly ResolvedSkillBindingTarget[]
}) {
  return resolveAvailability({
    definitions: listWorkflowSkills(params.scope),
    bindings: params.bindings,
    targets: params.targets,
    getDefinition: getWorkflowSkill,
  })
}

export function resolveToolSkillAvailability(params: {
  scope: CompanionSkillScope
  bindings: readonly SkillBindingRecord[]
  targets: readonly ResolvedSkillBindingTarget[]
}) {
  return resolveAvailability({
    definitions: listToolSkills(params.scope),
    bindings: params.bindings,
    targets: params.targets,
    getDefinition: getToolSkill,
  })
}

export function buildSkillCatalog(params: {
  bindings: readonly SkillBindingRecord[]
  targets: readonly ResolvedSkillBindingTarget[]
  directTarget: ResolvedSkillBindingTarget
  scope?: CompanionSkillScope
}): CompanionSkillCatalogItem[] {
  const definitions = params.scope
    ? listSkills(params.scope)
    : listRegisteredSkills()

  return definitions.map((definition) => {
    const effectiveBinding = findEffectiveBinding({
      bindings: params.bindings,
      targets: params.targets,
      skillId: definition.manifest.id,
    })
    const directBinding = params.bindings.find((binding) => (
      binding.skillId === definition.manifest.id
      && binding.scopeType === params.directTarget.scopeType
      && binding.scopeId === params.directTarget.scopeId
    ))
    const effectiveDefinition = effectiveBinding?.skillVersion
      ? getRegisteredSkill(definition.manifest.id, effectiveBinding.skillVersion)
      : definition

    return {
      manifest: definition.manifest,
      effectiveEnabled: Boolean(effectiveDefinition)
        && (effectiveBinding?.enabled ?? definition.manifest.enabledByDefault),
      bindingSource: effectiveBinding?.scopeType ?? 'default',
      overrideEnabled: directBinding?.enabled ?? null,
    }
  })
}

export const buildPromptSkillCatalog = buildSkillCatalog
