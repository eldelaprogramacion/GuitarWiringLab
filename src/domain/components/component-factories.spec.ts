import {
  createCapacitor,
  createGround,
  createMonoJack,
  createPickup,
  createPotentiometer,
  createStringExciter,
} from './component-factories'
import { validateCircuitComponent } from './component-validation'

describe('component factories', () => {
  it('creates a configurable four-conductor humbucker with separate coil pins and shield', () => {
    const humbucker = createPickup({
      id: 'bridge-humbucker',
      params: { coilCount: 2, conductorMode: '4_conductor', hasShield: true },
    })

    expect(humbucker.type).toBe('pickup')
    expect(humbucker.pins.map((pin) => pin.id)).toEqual([
      'north_start',
      'north_finish',
      'south_start',
      'south_finish',
      'shield',
    ])
  })

  it('creates the required base examples without validation issues', () => {
    const components = [
      createPickup({ id: 'single' }),
      createPickup({
        id: 'humbucker',
        params: { coilCount: 2, conductorMode: '4_conductor', hasShield: true },
      }),
      createPotentiometer({ id: 'volume', params: { resistanceOhms: 250000 } }),
      createCapacitor({ id: 'cap-22nf', params: { capacitanceFarads: 22e-9 } }),
      createMonoJack({ id: 'jack' }),
      createGround({ id: 'ground' }),
    ]

    expect(components.every((component) => validateCircuitComponent(component).valid)).toBe(true)
  })

  it('creates potentiometers and mono jacks with the expected connection pins', () => {
    const pot = createPotentiometer({ id: 'volume' })
    const jack = createMonoJack({ id: 'output' })

    expect(pot.pins.map((pin) => pin.id)).toEqual(['in', 'out', 'ground'])
    expect(jack.pins.map((pin) => pin.id)).toEqual(['tip', 'sleeve'])
  })

  it('creates a string exciter without electrical pins', () => {
    const exciter = createStringExciter({ id: 'strings' })

    expect(exciter.type).toBe('string_exciter')
    expect(exciter.pins).toEqual([])
    expect(validateCircuitComponent(exciter).valid).toBe(true)
  })
})
