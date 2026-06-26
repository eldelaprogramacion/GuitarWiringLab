import type { ElectricalConnection } from '@/domain/components/circuit-component'
import {
  createGround,
  createMonoJack,
  createPickup,
  createPotentiometer,
} from '@/domain/components/component-factories'
import { buildCircuitGraph } from './circuit-graph'

const pickup = createPickup({
  id: 'pickup-neck',
  label: 'Neck Pickup',
  position: { x: 80, y: 120 },
})

const volume = createPotentiometer({
  id: 'volume',
  label: 'Volume',
  position: { x: 320, y: 120 },
})

const jack = createMonoJack({
  id: 'jack',
  label: 'Output Jack',
  position: { x: 560, y: 120 },
})

const ground = createGround({
  id: 'ground',
  label: 'Common Ground',
  position: { x: 320, y: 280 },
})

export const exampleElectricalConnections: ElectricalConnection[] = [
  {
    id: 'wire-pickup-to-volume',
    color: '#111111',
    from: { componentId: 'pickup-neck', pinId: 'hot' },
    to: { componentId: 'volume', pinId: 'in' },
  },
  {
    id: 'wire-volume-to-jack',
    color: '#222222',
    from: { componentId: 'volume', pinId: 'out' },
    to: { componentId: 'jack', pinId: 'tip' },
  },
  {
    id: 'wire-ground-to-jack',
    color: '#333333',
    from: { componentId: 'ground', pinId: 'ground' },
    to: { componentId: 'jack', pinId: 'sleeve' },
  },
]

export const exampleCircuitGraph = buildCircuitGraph(
  [pickup, volume, jack, ground],
  exampleElectricalConnections,
)
