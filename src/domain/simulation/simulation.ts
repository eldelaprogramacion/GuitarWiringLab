export type SimulationReadiness = 'not-ready' | 'valid' | 'warning'

export interface SimulationSummary {
  readiness: SimulationReadiness
  message: string
}
