import {
  createCapacitor,
  createGround,
  createMonoJack,
  createPickup,
  createPotentiometer,
} from './component-factories'

export const exampleSingleCoil = createPickup({
  id: 'pickup-neck-single',
  label: 'Neck Single Coil',
  position: { x: 80, y: 80 },
})

export const exampleFourConductorHumbucker = createPickup({
  id: 'pickup-bridge-humbucker',
  label: 'Bridge Humbucker 4-Conductor',
  params: {
    coilCount: 2,
    conductorMode: '4_conductor',
    hasShield: true,
  },
  position: { x: 80, y: 220 },
})

export const exampleVolumePot250k = createPotentiometer({
  id: 'volume-250k',
  label: 'Volume 250k',
  params: {
    resistanceOhms: 250000,
    taper: 'audio',
  },
  position: { x: 360, y: 120 },
})

export const exampleToneCap22nF = createCapacitor({
  id: 'tone-cap-22nf',
  label: 'Tone Capacitor 22nF',
  params: {
    capacitanceFarads: 22e-9,
  },
  position: { x: 360, y: 260 },
})

export const exampleMonoJack = createMonoJack({
  id: 'output-jack',
  label: 'Mono Output Jack',
  position: { x: 640, y: 140 },
})

export const exampleGround = createGround({
  id: 'common-ground',
  label: 'Common Ground',
  position: { x: 640, y: 280 },
})

export const componentCreationExamples = [
  exampleSingleCoil,
  exampleFourConductorHumbucker,
  exampleVolumePot250k,
  exampleToneCap22nF,
  exampleMonoJack,
  exampleGround,
]
