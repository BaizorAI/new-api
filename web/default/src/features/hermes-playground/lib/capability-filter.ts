import type { HermesCapabilitySection } from './workspace-panel-controller'

/**
 * Project-specific filter for the Hermes capability center.
 *
 * Items listed here are not removed; they are rendered in a collapsed
 * "Backup / Other" section so the main list only shows skills and tools
 * considered relevant for this project. Edit this file to adjust the lists.
 */

export interface HermesCapabilityFilterConfig {
  /** Skill sections that should be moved entirely to the backup area. */
  backupSkillSections: HermesCapabilitySection[]
  /** Built-in skill categories that should be moved to the backup area. */
  backupSkillCategories: string[]
  /** Toolset names that should be moved to the backup area. */
  backupToolsetNames: string[]
}

export const HERMES_CAPABILITY_FILTER: HermesCapabilityFilterConfig = {
  // "Jilai Law Firm Skills" belongs to a different product/project.
  backupSkillSections: ['jilai'],
  // Creative, media, ML-ops, smart-home and social skills are not relevant
  // for an AI API gateway admin console.
  backupSkillCategories: [
    'creative',
    'media',
    'mlops',
    'smart-home',
    'social-media',
    'email',
  ],
  // Entertainment, home automation, social-platform and some creative
  // toolsets are not relevant for this project.
  backupToolsetNames: [
    'video',
    'video_gen',
    'x_search',
    'tts',
    'image_gen',
    'homeassistant',
    'spotify',
    'discord',
    'discord_admin',
    'yuanbao',
    'computer_use',
  ],
}

export function isBackupSkillSection(
  sectionId: HermesCapabilitySection,
  config: HermesCapabilityFilterConfig = HERMES_CAPABILITY_FILTER
): boolean {
  return config.backupSkillSections.includes(sectionId)
}

export function isBackupSkillCategory(
  category: string | undefined,
  config: HermesCapabilityFilterConfig = HERMES_CAPABILITY_FILTER
): boolean {
  if (!category) return false
  return config.backupSkillCategories.includes(category.toLowerCase())
}

export function isBackupToolset(
  toolsetName: string,
  config: HermesCapabilityFilterConfig = HERMES_CAPABILITY_FILTER
): boolean {
  return config.backupToolsetNames.includes(toolsetName)
}
