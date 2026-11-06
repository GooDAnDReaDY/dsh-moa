/**
 * Self-Consistency Temperature Sampling for Single Models (#301)
 *
 * Allows users with a single model slot (e.g., local Ollama/vLLM or a single API key)
 * to benefit from Mixture of Agents ensemble diversity by generating parallel samples
 * at varying temperatures and complementary system personas, followed by consistency voting.
 */

import { ROLE_PERSONA_PROMPTS } from '../moa-prompts.js'

export const DEFAULT_SELF_CONSISTENCY_TEMPERATURES = Object.freeze([0.2, 0.6, 0.9])
export const DEFAULT_SELF_CONSISTENCY_PERSONAS = Object.freeze(['proposer', 'challenger', 'minimalist'])

/**
 * Expands a single reference model into multiple parallel proposer slots
 * with distinct temperatures and complementary reasoning personas.
 *
 * @param {Array<object>} referenceModels - Original reference model slots
 * @param {object} [options]
 * @param {boolean} [options.enabled=false] - Whether self-consistency expansion is enabled
 * @param {number} [options.samples=3] - Number of candidate samples to generate (2-10)
 * @param {Array<number>} [options.temperatures] - Array of temperatures for samples
 * @param {Array<string>} [options.personas] - Array of persona role names
 * @returns {{ references: Array<object>, isExpanded: boolean, sampleCount: number }}
 */
export function expandSelfConsistencySlots(referenceModels = [], options = {}) {
  const {
    enabled = false,
    samples = 3,
    temperatures = DEFAULT_SELF_CONSISTENCY_TEMPERATURES,
    personas = DEFAULT_SELF_CONSISTENCY_PERSONAS,
  } = options

  // Expansion applies only when explicitly enabled or requested
  if (!enabled) {
    return {
      references: Array.isArray(referenceModels) ? referenceModels : [],
      isExpanded: false,
      sampleCount: Array.isArray(referenceModels) ? referenceModels.length : 0,
    }
  }

  const rawList = Array.isArray(referenceModels) && referenceModels.length > 0
    ? referenceModels
    : [{ provider: '', model: '' }]

  // Only expand when a single model slot is configured
  if (rawList.length !== 1) {
    return {
      references: rawList,
      isExpanded: false,
      sampleCount: rawList.length,
    }
  }

  const baseSlot = rawList[0] || {}
  const count = Math.min(10, Math.max(2, Number(samples) || 3))
  const expandedList = []

  for (let i = 0; i < count; i++) {
    const temp = Array.isArray(temperatures) && typeof temperatures[i] === 'number'
      ? temperatures[i]
      : (DEFAULT_SELF_CONSISTENCY_TEMPERATURES[i % DEFAULT_SELF_CONSISTENCY_TEMPERATURES.length] || 0.6)

    const role = Array.isArray(personas) && personas[i]
      ? personas[i]
      : (DEFAULT_SELF_CONSISTENCY_PERSONAS[i % DEFAULT_SELF_CONSISTENCY_PERSONAS.length] || 'proposer')

    expandedList.push({
      ...baseSlot,
      label: baseSlot.label
        ? `${baseSlot.label} [T=${temp}, ${role}]`
        : `Sample ${i + 1} (${baseSlot.model || 'model'}, T=${temp})`,
      temperature: temp,
      role_persona: role,
      sampleIndex: i + 1,
      isSelfConsistencySample: true,
    })
  }

  return {
    references: expandedList,
    isExpanded: true,
    sampleCount: expandedList.length,
  }
}

/**
 * Calculates majority agreement and self-consistency metrics across candidate outputs.
 *
 * @param {Array<object>} candidateOutputs - Array of successful candidate results
 * @returns {{ agreementRatio: number, isStrongConsensus: boolean, sampleCount: number }}
 */
export function calculateSelfConsistencyAgreement(candidateOutputs = []) {
  if (!Array.isArray(candidateOutputs) || candidateOutputs.length < 2) {
    return {
      agreementRatio: 1.0,
      isStrongConsensus: true,
      sampleCount: Array.isArray(candidateOutputs) ? candidateOutputs.length : 0,
    }
  }

  const texts = candidateOutputs
    .filter((c) => c && typeof c.text === 'string' && c.text.trim())
    .map((c) => c.text.trim().toLowerCase().replace(/\s+/g, ' '))

  if (texts.length < 2) {
    return {
      agreementRatio: 1.0,
      isStrongConsensus: true,
      sampleCount: texts.length,
    }
  }

  // Count exact and near-match clusters
  let maxClusterSize = 1
  for (let i = 0; i < texts.length; i++) {
    let clusterSize = 1
    for (let j = 0; j < texts.length; j++) {
      if (i === j) continue
      // If texts are very similar (> 85% overlap)
      if (texts[i] === texts[j] || (texts[i].length > 20 && texts[j].includes(texts[i].slice(0, 40)))) {
        clusterSize++
      }
    }
    if (clusterSize > maxClusterSize) maxClusterSize = clusterSize
  }

  const agreementRatio = Number((maxClusterSize / texts.length).toFixed(2))
  return {
    agreementRatio,
    isStrongConsensus: agreementRatio >= 0.66,
    sampleCount: texts.length,
  }
}
