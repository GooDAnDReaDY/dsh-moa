/**
 * File Workspace Management and Path Safety
 * Modularized into lib/workspace/ for maintainability and line budget compliance.
 */

export {
  isSafeRelativePath,
  normalizeRelativePath,
  assertPathContained,
  isLoopbackUrl,
} from './workspace/security.js'

export {
  verifyFileSyntax,
  computeLineDiff,
} from './workspace/diff.js'

export {
  formatProjectContext,
  collectProjectContext,
  isRefinementTask,
} from './workspace/scanner.js'

export {
  createPrePromotionCheckpoint,
} from './workspace/checkpoint.js'

export {
  resolveCandidateFolder,
  extractFileBlocks,
  writeCandidateWorkspace,
  promoteCandidateWorkspace,
  cleanMoaWorkspaces,
  readCandidateFiles,
} from './workspace/fs.js'
