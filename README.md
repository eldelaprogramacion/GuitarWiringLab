# GuitarWiringLab

Aplicacion web para disenar, validar y simular cableados pasivos de guitarras electricas. El objetivo inicial es un editor visual con Vue Flow y un motor de validacion electrica basado en grafos, sin backend ni simulacion de audio real.

## Stack

- Vue 3
- TypeScript
- Vite
- Pinia
- Vue Flow
- Vitest
- Docker y Docker Compose

## Ejecutar con Docker

```bash
docker compose up --build
```

La aplicacion quedara disponible en:

```text
http://localhost:5173
```

El codigo se monta como volumen para permitir hot reload. `node_modules` se mantiene dentro del contenedor para evitar conflictos con dependencias del host.

## Ejecutar sin Docker

```bash
npm install
npm run dev
```

## Scripts disponibles

```bash
npm run dev
npm run build
npm run preview
npm run test
npm run test:watch
npm run typecheck
```

## Estructura principal

```text
src/
  app/
  components/
  features/
    workspace/
    component-catalog/
    circuit-engine/
    validators/
    presets/
    oscilloscope/
  domain/
    components/
    switches/
    graph/
    simulation/
  stores/
  types/
  utils/
```

## Alcance inicial

Esta version prepara la base para:

- Crear nodos visuales de componentes de guitarra.
- Mantener el circuito en estado global con Pinia.
- Catalogar componentes electricos pasivos iniciales.
- Validar reglas basicas del grafo.
- Extender el motor hacia simulaciones mas sofisticadas en futuras iteraciones.

## Workspace visual

Cada cable nuevo recibe automaticamente un color de una paleta reutilizable de 256 colores. Las aristas de Vue Flow usan ese color y el nombre de cada pin conectado adopta el color del cable; si un pin no tiene conexiones, su nombre vuelve a negro. Los handles, el cuerpo del componente y los iconos esquematicos se mantienen estaticos para no mezclar estado visual con electronica.
