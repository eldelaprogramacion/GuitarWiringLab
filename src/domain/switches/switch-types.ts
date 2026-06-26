export type SwitchThrowMode = 'on-on' | 'on-off-on' | 'on-on-on'

export type SwitchPoleCount = 1 | 2 | 3 | 4

export interface SwitchConfiguration {
  poles: SwitchPoleCount
  mode: SwitchThrowMode
  positions: number
}
