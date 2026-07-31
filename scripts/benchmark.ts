import { performance } from 'node:perf_hooks'

import {
  fastHorizontalCompactor,
  fastVerticalCompactor,
  horizontalCompactor,
  verticalCompactor,
} from '../src/core/compactors'
import {
  InteractionTransactionBuffer,
  MAX_SUPERSEDED_CODE_UNITS,
  MAX_SUPERSEDED_SIGNATURES,
} from '../src/core/transaction-buffer'

import type { Compactor, Layout } from '../src/helpers/types'

interface BenchmarkCase {
  name: string
  layout: Layout
  cols: number
  standard: Compactor
  indexed: Compactor
  candidateProfile: string
}

interface TimingResult {
  medianMs: number
  p95Ms: number
  minMs: number
  checksum: number
}

const quick = process.argv.includes('--quick')
const warmups = quick ? 1 : 2
const samples = quick ? 3 : 7
const itemCount = 1000

function sparseVertical(): Layout {
  return Array.from({ length: itemCount }, (_, index) => ({
    i: `sparse-v-${index}`,
    x: index,
    y: 40,
    w: 1,
    h: 1,
  }))
}

function sparseHorizontal(): Layout {
  return Array.from({ length: itemCount }, (_, index) => ({
    i: `sparse-h-${index}`,
    x: 40,
    y: index,
    w: 1,
    h: 1,
  }))
}

function denseVertical(): Layout {
  return Array.from({ length: itemCount }, (_, index) => ({
    i: `dense-${index}`,
    x: index % 40,
    y: 40 + Math.floor(index / 40) * 2,
    w: 1,
    h: 1,
  }))
}

function largeCoordinateVertical(): Layout {
  return Array.from({ length: itemCount }, (_, index) => ({
    i: `large-${index}`,
    x: index % 40,
    y: 1_000_000 + Math.floor(index / 40) * 2,
    w: 1,
    h: 1,
  }))
}

function staticMixedVertical(): Layout {
  return Array.from({ length: itemCount }, (_, index) => ({
    i: `static-${index}`,
    x: index % 40,
    y: 40 + Math.floor(index / 40) * 2,
    w: 1,
    h: 1,
    static: index % 10 === 0,
  }))
}

function highCandidateVertical(): Layout {
  return Array.from({ length: itemCount }, (_, index) => ({
    i: `candidate-${index}`,
    x: 0,
    y: 40 + index * 2,
    w: 1,
    h: 1,
  }))
}

const cases: BenchmarkCase[] = [
  {
    name: 'vertical / sparse',
    layout: sparseVertical(),
    cols: itemCount,
    standard: verticalCompactor,
    indexed: fastVerticalCompactor,
    candidateProfile: 'near zero x-overlap candidates',
  },
  {
    name: 'horizontal / sparse',
    layout: sparseHorizontal(),
    cols: 80,
    standard: horizontalCompactor,
    indexed: fastHorizontalCompactor,
    candidateProfile: 'near zero y-overlap candidates',
  },
  {
    name: 'vertical / dense',
    layout: denseVertical(),
    cols: 40,
    standard: verticalCompactor,
    indexed: fastVerticalCompactor,
    candidateProfile: 'about 25 candidates per x lane',
  },
  {
    name: 'vertical / large coordinate',
    layout: largeCoordinateVertical(),
    cols: 40,
    standard: verticalCompactor,
    indexed: fastVerticalCompactor,
    candidateProfile: 'about 25 candidates per x lane',
  },
  {
    name: 'vertical / 10% static',
    layout: staticMixedVertical(),
    cols: 40,
    standard: verticalCompactor,
    indexed: fastVerticalCompactor,
    candidateProfile: 'mixed static and dynamic candidates',
  },
  {
    name: 'vertical / high candidate count',
    layout: highCandidateVertical(),
    cols: 1,
    standard: verticalCompactor,
    indexed: fastVerticalCompactor,
    candidateProfile: 'all prior items overlap on x',
  },
]

function resultChecksum(layout: Layout): number {
  let checksum = 0
  for (let index = 0; index < layout.length; index++) {
    checksum = (checksum + layout[index].x * 31 + layout[index].y * 17 + index) >>> 0
  }
  return checksum
}

function measure(run: () => Layout): TimingResult {
  for (let index = 0; index < warmups; index++) run()

  let checksum = 0
  const durations = Array.from({ length: samples }, () => {
    const start = performance.now()
    const layout = run()
    const duration = performance.now() - start
    checksum ^= resultChecksum(layout)
    return duration
  }).sort((first, second) => first - second)

  return {
    minMs: durations[0],
    medianMs: durations[Math.floor(durations.length / 2)],
    p95Ms: durations[Math.ceil(durations.length * 0.95) - 1],
    checksum,
  }
}

function rounded(value: number): number {
  return Number(value.toFixed(3))
}

function runCompactorBenchmarks(): void {
  const rows = cases.flatMap(entry => {
    const standard = measure(() => entry.standard.compact(entry.layout, entry.cols))
    const indexed = measure(() => entry.indexed.compact(entry.layout, entry.cols))
    return [
      {
        dataset: entry.name,
        implementation: 'standard',
        candidates: entry.candidateProfile,
        medianMs: rounded(standard.medianMs),
        p95Ms: rounded(standard.p95Ms),
        minMs: rounded(standard.minMs),
        checksum: standard.checksum,
      },
      {
        dataset: entry.name,
        implementation: 'interval-indexed',
        candidates: entry.candidateProfile,
        medianMs: rounded(indexed.medianMs),
        p95Ms: rounded(indexed.p95Ms),
        minMs: rounded(indexed.minMs),
        checksum: indexed.checksum,
      },
    ]
  })

  console.log(`\nCompactor benchmark (${itemCount} items, ${warmups} warmups, ${samples} samples)`)
  console.table(rows)
}

function heapUsed(): number {
  return process.memoryUsage().heapUsed
}

function toMiB(bytes: number): number {
  return rounded(bytes / 1024 / 1024)
}

function runInteractionBenchmark(): void {
  const interactionBuffers = new InteractionTransactionBuffer()
  const candidateCount = 10_000
  const proposalStart = performance.now()
  for (let index = 0; index < candidateCount; index++) {
    interactionBuffers.replaceProposal({
      type: 'drag',
      id: 'active',
      value: { x: index, y: 0 },
      nativeEvent: null,
    })
  }
  const latest = interactionBuffers.takeProposal()
  const proposalDuration = performance.now() - proposalStart

  const layout = sparseVertical()
  globalThis.gc?.()
  const heapBefore = heapUsed()
  let longestSignatureMs = 0
  const cacheStart = performance.now()
  for (let revision = 0; revision < MAX_SUPERSEDED_SIGNATURES + 128; revision++) {
    layout[0].x = revision
    const start = performance.now()
    interactionBuffers.rememberSuperseded(layout)
    longestSignatureMs = Math.max(longestSignatureMs, performance.now() - start)
  }
  const cacheDuration = performance.now() - cacheStart
  const heapAfterFill = heapUsed()
  const retained = interactionBuffers.snapshot()
  if (
    retained.supersededCount > MAX_SUPERSEDED_SIGNATURES ||
    retained.retainedCodeUnits > MAX_SUPERSEDED_CODE_UNITS
  ) {
    throw new Error('Interaction buffer exceeded its structural retention limits')
  }

  interactionBuffers.finishTerminal()
  const afterTerminal = interactionBuffers.snapshot()
  if (
    afterTerminal.pendingProposal ||
    afterTerminal.supersededCount !== 0 ||
    afterTerminal.retainedCodeUnits !== 0
  ) {
    throw new Error('Interaction buffer retained resources after terminal')
  }
  globalThis.gc?.()
  const heapAfterTerminal = heapUsed()

  console.log('\nControlled interaction benchmark')
  console.table([
    {
      items: itemCount,
      inputCandidates: candidateCount,
      evaluatedProposals: latest ? 1 : 0,
      latestX: latest?.type === 'drag' && 'x' in latest.value ? latest.value.x : 'missing',
      coalescingMs: rounded(proposalDuration),
      retainedSignatures: retained.supersededCount,
      signatureLimit: MAX_SUPERSEDED_SIGNATURES,
      retainedMiB: toMiB(retained.retainedCodeUnits * 2),
      retainedBudgetMiB: toMiB(MAX_SUPERSEDED_CODE_UNITS * 2),
      fillHeapDeltaMiB: toMiB(heapAfterFill - heapBefore),
      terminalHeapDeltaMiB: toMiB(heapAfterTerminal - heapBefore),
      terminalCleared:
        !afterTerminal.pendingProposal &&
        afterTerminal.supersededCount === 0 &&
        afterTerminal.retainedCodeUnits === 0,
      cacheFillMs: rounded(cacheDuration),
      longestSignatureMs: rounded(longestSignatureMs),
      gc: typeof globalThis.gc === 'function' ? 'forced' : 'not exposed',
    },
  ])
}

console.log(`Grid Layout Plus benchmark profile: ${quick ? 'quick' : 'full'}`)
console.log('Results are evidence only and do not enforce machine-dependent timing thresholds.')
runCompactorBenchmarks()
runInteractionBenchmark()
