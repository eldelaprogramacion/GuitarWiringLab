export type OscilloscopeStatus =
  | 'signal-ok'
  | 'output-shorted'
  | 'no-signal-path'
  | 'no-signal-source'
  | 'missing-ground'
  | 'muted-switch-position'
  | 'floating-output'

export interface WaveformPoint {
  timeMs: number
  voltage: number
}

export interface OscilloscopeReading {
  status: OscilloscopeStatus
  statusLabel: string
  message: string
  isFlat: boolean
  frequencyHz: number
  amplitudeVolts: number
  referenceAmplitudeVolts: number
  durationMs: number
  points: WaveformPoint[]
}
