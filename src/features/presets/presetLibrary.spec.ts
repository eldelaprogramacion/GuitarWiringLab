import { validateCircuit } from '@/features/validators/electrical-validator'
import {
  createPresetValidationContext,
  loadPreset,
  presetLibrary,
} from './presetLibrary'

const expectedPresetNames = [
  'S - Jack',
  'S - Kill switch - Jack',
  'S - Phase switch - Jack',
  'S - Vol - Jack',
  'S - Vol 50s - Jack',
  'S - Vol (treble bleed serie) - Jack',
  'S - Vol (treble bleed paralelo) - Jack',
  'S - Vol - Tono - Jack',
  'S - Vol - Tono 50s - Jack',
  'H - Split S/B - Jack',
  'H - Split N/B/S - Jack',
  'H - serie/paralelo - Jack',
  'SS - Selector - Vol - Tono - Jack',
  'SS - 2 Vol(indeps) - 2 Tono(indeps) - Selector - Jack',
  'HH - Selector - Vol - Tono - Jack',
  'HH - 2 Vol(indeps) - 2 Tono (indeps) - Selector - Jack',
  'SSS - Selector - Vol - Tono - Jack',
  'SSS - 2 Tono (indeps) - Selector - vol - Jack',
  'SSS - 2 Vol(indeps) - 2 Tono (indeps) - Selector - Jack',
  'PTB: treble cut + bass cut',
]

const expectedPresetIds = [
  's-jack',
  's-kill-switch-jack',
  's-phase-switch-jack',
  's-vol-jack',
  's-vol-50s-jack',
  's-vol-treble-bleed-series-jack',
  's-vol-treble-bleed-parallel-jack',
  's-vol-tone-jack',
  's-vol-tone-50s-jack',
  'h-split-s-b-jack',
  'h-split-n-b-s-jack',
  'h-series-parallel-jack',
  'ss-selector-vol-tone-jack',
  'ss-2vol-2tone-selector-jack',
  'hh-selector-vol-tone-jack',
  'hh-2vol-2tone-selector-jack',
  'sss-selector-vol-tone-jack',
  'sss-2tone-selector-vol-jack',
  'sss-2vol-2tone-selector-jack',
  'ptb-treble-cut-bass-cut',
]

describe('presetLibrary', () => {
  it('exposes only the requested presets in the requested order', () => {
    expect(presetLibrary.map((preset) => preset.id)).toEqual(expectedPresetIds)
    expect(presetLibrary.map((preset) => preset.name)).toEqual(expectedPresetNames)
  })

  it.each(expectedPresetIds)('loads %s with a string exciter', (presetId) => {
    const preset = loadPreset(presetId)

    expect(preset.id).toBe(presetId)
    expect(preset.components.some((component) => component.type === 'string_exciter')).toBe(true)
    expect(preset.components.some((component) => component.type === 'mono_jack')).toBe(true)
  })

  it('returns fresh component instances on each load', () => {
    const first = loadPreset('s-vol-jack')
    const second = loadPreset('s-vol-jack')

    first.components[0].label = 'Changed'

    expect(second.components[0].label).toBe('Single coil')
  })

  it('defines the SSS 5-position selector order', () => {
    const preset = loadPreset('sss-selector-vol-tone-jack')

    expect(preset.switchPositions.map((position) => position.label)).toEqual([
      'Puente',
      'Puente + Medio',
      'Medio',
      'Medio + Mastil',
      'Mastil',
    ])
  })

  it('defines the humbucker split positions', () => {
    const singleBoth = loadPreset('h-split-s-b-jack')
    const northBothSouth = loadPreset('h-split-n-b-s-jack')

    expect(singleBoth.switchPositions.map((position) => position.label)).toEqual(['S', 'B'])
    expect(northBothSouth.switchPositions.map((position) => position.label)).toEqual([
      'N',
      'B',
      'S',
    ])
  })

  it('keeps legacy presets out of the public library', () => {
    const text = presetLibrary
      .flatMap((preset) => [preset.id, preset.name, preset.description])
      .join(' ')
      .toLowerCase()

    expect(text).not.toContain('hsh')
    expect(text).not.toContain('hhh')
    expect(text).not.toContain('strat')
    expect(text).not.toContain('les paul')
    expect(text).not.toContain('les-paul')
  })

  it.each(
    expectedPresetIds.filter(
      (presetId) =>
        presetId !== 's-kill-switch-jack' &&
        presetId !== 's-phase-switch-jack' &&
        presetId !== 'h-split-n-b-s-jack',
    ),
  )('%s has no critical validation errors', (presetId) => {
    const preset = loadPreset(presetId)
    const result = validateCircuit(createPresetValidationContext(preset))

    expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([])
  })
})
