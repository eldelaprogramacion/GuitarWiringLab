<template>
  <div class="app-shell">
    <header class="app-shell__header">
      <div>
        <p class="app-shell__eyebrow">Laboratorio de cableado</p>
        <h1>GuitarWiringLab</h1>
      </div>
      <div class="app-shell__status">Motor de grafos en frontend</div>
    </header>

    <aside class="app-shell__sidebar">
      <slot name="sidebar" />
    </aside>

    <main class="app-shell__workspace">
      <slot />
    </main>

    <aside class="app-shell__inspector">
      <slot name="inspector" />
    </aside>

    <footer class="app-shell__validation">
      <slot name="validation" />
    </footer>
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  width: 100%;
  min-width: 0;
  height: 100%;
  grid-template-areas:
    "header header header"
    "sidebar workspace inspector"
    "validation validation validation";
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr) minmax(240px, 320px);
  grid-template-rows: 72px minmax(0, 1fr) auto;
  color: var(--color-text);
  background:
    radial-gradient(circle at 20% 0%, rgb(66 49 24 / 32%), transparent 34%),
    linear-gradient(135deg, #17130f 0%, var(--color-bg) 48%, #10110f 100%);
}

.app-shell__header {
  grid-area: header;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--color-border);
  background: rgb(12 13 11 / 82%);
  backdrop-filter: blur(14px);
}

.app-shell__header h1,
.app-shell__eyebrow {
  margin: 0;
}

.app-shell__header h1 {
  color: var(--color-text);
  font-size: 1.25rem;
  font-weight: 760;
}

.app-shell__eyebrow {
  color: var(--color-accent);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.app-shell__status {
  padding: 8px 10px;
  border: 1px solid rgb(214 168 79 / 45%);
  border-radius: 8px;
  color: #17130c;
  background: var(--color-accent);
  font-size: 0.85rem;
  font-weight: 700;
  white-space: nowrap;
}

.app-shell__sidebar,
.app-shell__inspector {
  min-width: 0;
  padding: 16px;
  overflow: auto;
  border-color: var(--color-border);
  background: var(--color-panel);
  backdrop-filter: blur(12px);
}

.app-shell__sidebar {
  grid-area: sidebar;
  border-right: 1px solid var(--color-border);
}

.app-shell__workspace {
  grid-area: workspace;
  min-width: 0;
  min-height: 0;
}

.app-shell__inspector {
  grid-area: inspector;
  border-left: 1px solid var(--color-border);
}

.app-shell__validation {
  grid-area: validation;
  min-width: 0;
}

@media (max-width: 1000px) {
  .app-shell {
    grid-template-areas:
      "header"
      "workspace"
      "sidebar"
      "inspector"
      "validation";
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(420px, 1fr) auto auto auto;
    height: auto;
    min-height: 100%;
  }

  .app-shell__header {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }

  .app-shell__sidebar,
  .app-shell__inspector {
    border: 0;
    border-top: 1px solid var(--color-border);
  }
}
</style>
