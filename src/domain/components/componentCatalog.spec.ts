import {
  componentCatalog,
  createComponentFromCatalogItem,
  getCatalogByCategory,
} from './componentCatalog'

describe('componentCatalog', () => {
  it('contains the requested initial catalog items', () => {
    expect(componentCatalog).toHaveLength(11)
    expect(componentCatalog.map((item) => item.id)).toEqual([
      'pickup',
      'potentiometer',
      'capacitor',
      'resistor',
      'mono_jack',
      'ground',
      'switch',
      'selector',
      'oscilloscope_probe',
      'signal_generator',
      'string_exciter',
    ])
  })

  it('filters catalog items by category', () => {
    const passives = getCatalogByCategory('passives')

    expect(passives).toHaveLength(3)
    expect(passives.map((item) => item.id)).toEqual(['potentiometer', 'capacitor', 'resistor'])
    expect(passives.every((item) => item.category === 'passives')).toBe(true)
  })

  it('does not expose singleton catalog categories', () => {
    const countsByCategory = componentCatalog.reduce<Record<string, number>>((counts, item) => {
      counts[item.category] = (counts[item.category] ?? 0) + 1
      return counts
    }, {})

    expect(Object.values(countsByCategory).every((count) => count > 1)).toBe(true)
  })

  it('uses generic selector labels in the catalog', () => {
    const selectors = componentCatalog.filter((item) => item.id === 'selector')
    const text = selectors
      .flatMap((item) => [item.id, item.label, item.description, ...item.tags])
      .join(' ')
      .toLowerCase()

    expect(text).not.toContain('strat')
    expect(text).not.toContain('les paul')
    expect(text).not.toContain('les-paul')
  })

  it('creates a workspace component from a catalog item', () => {
    const item = componentCatalog.find((catalogItem) => catalogItem.id === 'pickup')

    expect(item).toBeDefined()

    const component = createComponentFromCatalogItem(item!, {
      id: 'bridge-humbucker',
      position: { x: 100, y: 200 },
    })

    expect(component.type).toBe('pickup')
    expect(component.position).toEqual({ x: 100, y: 200 })
    expect(component.pins.map((pin) => pin.id)).toContain('hot')
  })
})
