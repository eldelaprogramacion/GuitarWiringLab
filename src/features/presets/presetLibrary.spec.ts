import { validateCircuit } from '@/features/validators/electrical-validator'
import {
  createPresetValidationContext,
  loadPreset,
  presetLibrary,
} from './presetLibrary'

describe('presetLibrary', () => {
  it('loads all initial presets', () => {
    expect(presetLibrary.map((preset) => preset.id)).toEqual([
      'single-pickup-volume-jack',
      'single-pickup-volume-tone-jack',
      'humbucker-split-single-both',
      'humbucker-split-north-both-south',
      'humbucker-series-split-parallel',
      'ss-3-position-volume-tone',
      'ss-3-position-2v2t',
      'hh-3-position-volume-tone',
      'hh-3-position-standard',
      'sss-5-position-standard',
      'sss-5-position-3-pots',
      'hsh-5-position-standard',
      'hsh-5-position-2v2t',
      'hhh-5-position-volume-tone',
    ])
  })

  it('uses compact ordered names for the sidebar', () => {
    expect(presetLibrary.map((preset) => preset.name)).toEqual([
      '01 S - Vol - Jack',
      '02 S - Vol/Tono - Jack',
      '03 HB - Split simple/ambas',
      '04 HB - Split N/B/S',
      '05 HB - Serie/Split/Paralelo',
      '06 SS - Vol/Tono',
      '07 SS - 2 Vol/2 Tono',
      '08 HH - Vol/Tono',
      '09 HH - 2 Vol/2 Tono',
      '10 SSS - 5 posiciones',
      '11 SSS - 3 potenciometros',
      '12 HSH - Vol/Tono',
      '13 HSH - 2 Vol/2 Tono',
      '14 HHH - Vol/Tono',
    ])
  })

  it.each(presetLibrary)('$name has no critical validation errors', ({ id }) => {
    const preset = loadPreset(id)
    const result = validateCircuit(createPresetValidationContext(preset))

    expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([])
  })

  it('defines the standard SSS 5-position selector positions', () => {
    const preset = loadPreset('sss-5-position-standard')

    expect(preset.switchPositions.map((position) => position.label)).toEqual([
      'Puente',
      'Puente + Medio',
      'Medio',
      'Medio + Mastil',
      'Mastil',
    ])
  })

  it('defines an SSS 5-position preset with three potentiometers', () => {
    const preset = loadPreset('sss-5-position-3-pots')

    expect(preset.components.filter((component) => component.type === 'potentiometer'))
      .toHaveLength(3)
    expect(preset.switchPositions.map((position) => position.label)).toEqual([
      'Puente',
      'Puente + Medio',
      'Medio',
      'Medio + Mastil',
      'Mastil',
    ])
  })

  it('defines the standard HH 3-position toggle positions', () => {
    const preset = loadPreset('hh-3-position-volume-tone')

    expect(preset.switchPositions.map((position) => position.label)).toEqual([
      'Mastil',
      'Mastil + Puente',
      'Puente',
    ])
  })

  it('returns fresh component instances on each load', () => {
    const first = loadPreset('single-pickup-volume-jack')
    const second = loadPreset('single-pickup-volume-jack')

    first.components[0].label = 'Changed'

    expect(second.components[0].label).toBe('Single coil')
  })

  it('defines an HSH 5-position preset', () => {
    const preset = loadPreset('hsh-5-position-standard')
    const twoVolumesTwoTones = loadPreset('hsh-5-position-2v2t')

    expect(preset.components.map((component) => component.type)).toEqual(
      expect.arrayContaining(['pickup', 'selector']),
    )
    expect(preset.switchPositions.map((position) => position.label)).toEqual([
      'Puente',
      'Puente + Medio',
      'Medio',
      'Medio + Mastil',
      'Mastil',
    ])
    expect(twoVolumesTwoTones.components.map((component) => String(component.id))).toEqual(
      expect.arrayContaining(['neck-volume', 'bridge-volume', 'neck-tone', 'bridge-tone']),
    )
  })

  it('defines SS presets in both requested control combinations', () => {
    const master = loadPreset('ss-3-position-volume-tone')
    const twoVolumesTwoTones = loadPreset('ss-3-position-2v2t')

    expect(master.switchPositions.map((position) => position.label)).toEqual([
      'Mastil',
      'Mastil + Puente',
      'Puente',
    ])
    expect(twoVolumesTwoTones.components.map((component) => String(component.id))).toEqual(
      expect.arrayContaining(['neck-volume', 'bridge-volume', 'neck-tone', 'bridge-tone']),
    )
  })

  it('defines an HHH 5-position preset', () => {
    const preset = loadPreset('hhh-5-position-volume-tone')

    expect(preset.components.filter((component) => component.type === 'pickup')).toHaveLength(3)
    expect(preset.switchPositions.map((position) => position.label)).toEqual([
      'Puente',
      'Puente + Medio',
      'Medio',
      'Medio + Mastil',
      'Mastil',
    ])
  })

  it('defines humbucker split presets', () => {
    const singleBoth = loadPreset('humbucker-split-single-both')
    const northBothSouth = loadPreset('humbucker-split-north-both-south')

    expect(singleBoth.switchPositions.map((position) => position.label)).toEqual([
      'Single coil',
      'Ambas bobinas',
    ])
    expect(northBothSouth.switchPositions.map((position) => position.label)).toEqual([
      'Norte',
      'Ambas',
      'Sur',
    ])
  })

  it('does not expose legacy instrument names in preset labels', () => {
    const text = presetLibrary
      .flatMap((preset) => [preset.id, preset.name, preset.description])
      .join(' ')
      .toLowerCase()

    expect(text).not.toContain('strat')
    expect(text).not.toContain('les paul')
    expect(text).not.toContain('les-paul')
  })
})
