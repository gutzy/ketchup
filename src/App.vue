<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { Stage } from 'glue'
import EditorSidebar from './components/EditorSidebar.vue'
import SceneItemsPanel from './components/SceneItemsPanel.vue'
import { loadAllDataSets, glbUrlFor } from './util/splotData'
import { TransformControls } from 'three/addons/controls/TransformControls.js'

const stageContainer = ref(null)
const bgColor = ref('#2b2b2b')
const appData = ref({ itemBlueprints: [] })
const mode = ref('translate')
const selectedBox = ref(null)
const items = ref([])
const floorVisible = ref(true)

let stage
let transformControls
let isGizmoDragging = false
let gizmoRoot = null
const DEBUG_PICKING = true

onMounted(async () => {
  const bgHex = parseInt(bgColor.value.replace('#','0x'))
  const darker = darkenHex(bgHex, 0.6)

  stage = new Stage(stageContainer.value, {
    cameraType: 'orthographic',
    cameraInitialZoom: 14,
    cameraPosX: 0,
    cameraPosY: 100,
    cameraPosZ: 100,
    lookAtY: 0,
    enablePan: true,
    enableZoom: true,
    enableRotate: true,
    enableDrag: false,
    dragItems: false,
    backgroundColor: bgHex,
    floorColor: darker,
  })

  appData.value = await loadAllDataSets()
  // Simple floor plane ~4x4m (units)
  stage.sceneManager.createFloor(4, 4, darker)
  const floor0 = stage.scene.getObjectByName('ground')
  if (floor0) floor0.visible = floorVisible.value

  // initialize transform controls (helpers) for selected object
  transformControls = new TransformControls(stage.camera, stage.renderer.domElement)
  stage.scene.add(transformControls)
  transformControls.setMode(mode.value)
  gizmoRoot = (typeof transformControls.getHelper === 'function') ? transformControls.getHelper() : transformControls
  if (DEBUG_PICKING) console.log('[Init] TransformControls helper:', gizmoRoot)
  gizmoRoot = (typeof transformControls.getHelper === 'function') ? transformControls.getHelper() : transformControls
  transformControls.addEventListener('dragging-changed', (e) => {
    if (stage?.controlsManager?.orbitControls) {
      stage.controlsManager.orbitControls.enabled = !e.value
    }
    isGizmoDragging = !!e.value
  })
  // Ensure attached model updates when the box moves/rotates via gizmo
  transformControls.addEventListener('objectChange', () => {
    if (!selectedBox.value) return
    // prevent going below floor, allow up/down
    if (selectedBox.value.geometry?.parameters?.height) {
      const minY = selectedBox.value.geometry.parameters.height / 2
      if (selectedBox.value.position.y < minY) selectedBox.value.position.y = minY
    }
    selectedBox.value.dispatchEvent({ type: 'change' })
  })

  // selection via clicks (manage deselect ourselves; avoid ground-clicked auto handler)
  stage.renderer.domElement.addEventListener('click', onStageClick)
})

onBeforeUnmount(() => {
  stage?.renderer?.domElement?.removeEventListener('click', onStageClick)
  stage?.removeEventListener?.('ground-clicked', detachSelection)
})
watch(mode, (v) => {
  if (transformControls && selectedBox.value) transformControls.setMode(v)
  else if (stage?.controlsManager?.dragControls) stage.controlsManager.dragControls.mode = v
})

function onStageClick(e) {
  if (isGizmoDragging) return
  try {
    const rect = stage.renderer.domElement.getBoundingClientRect()
    stage.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    stage.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    stage.raycaster.setFromCamera(stage.mouse, stage.camera)
    // First, check if gizmo was hit anywhere
    const hitsAll = stage.raycaster.intersectObjects(stage.scene.children, true)
    if (DEBUG_PICKING) console.log('[Pick] hitsAll:', hitsAll.map(h => ({name:h.object?.name,type:h.object?.type, boxId:h.object?.boxId, dist: h.distance})))
    if (hitsAll.some(h => belongsToGizmo(h.object))) return

    // Then, check only against model roots to select
    const roots = stage.objectManager?.models || []
    const hitsModels = roots.length ? stage.raycaster.intersectObjects(roots, true) : []
    if (DEBUG_PICKING) console.log('[Pick] model roots:', roots.length, 'hitsModels:', hitsModels.length)
    if (hitsModels.length) {
      let obj = hitsModels[0].object
      while (obj && !obj.boxId && obj.parent) obj = obj.parent
      if (obj && obj.boxId) {
        const box = stage.getByUniqueId(obj.boxId)
        if (DEBUG_PICKING) console.log('[Pick] model hit -> boxId', obj.boxId, 'box?', !!box)
        if (box) attachSelection(box)
        return
      }
    }

    // Finally, if ground was hit or nothing else, deselect
    const floor = stage.scene.getObjectByName('ground')
    const hitFloor = floor ? stage.raycaster.intersectObject(floor, true).length > 0 : false
    if (hitFloor || !hitsAll.length) { if (DEBUG_PICKING) console.log('[Pick] ground or nothing -> detach'); detachSelection(); return }
    if (DEBUG_PICKING) console.log('[Pick] fallback detach')
    detachSelection()
  } catch { detachSelection() }
}

function attachSelection(box) {
  selectedBox.value = box
  if (transformControls) {
    transformControls.attach(box)
    transformControls.setMode(mode.value)
  }
  if (stage?.controlsManager?.dragControls) stage.controlsManager.dragControls.enabled = false
}

function detachSelection() {
  selectedBox.value = null
  if (transformControls) transformControls.detach()
  if (stage?.controlsManager?.dragControls) stage.controlsManager.dragControls.enabled = true
}


watch(bgColor, (v) => {
  if (!stage) return
  const hex = parseInt(v.replace('#', '0x'))
  const darker = darkenHex(hex, 0.6)
  stage.sceneManager.setupSceneSettings(hex, darker, stage.sceneManager.config?.curtainColor)
})

function darkenHex(hex, factor = 0.6) {
  const r = Math.max(0, Math.floor(((hex >> 16) & 0xff) * factor))
  const g = Math.max(0, Math.floor(((hex >> 8) & 0xff) * factor))
  const b = Math.max(0, Math.floor((hex & 0xff) * factor))
  return (r << 16) | (g << 8) | b
}

async function onAddBlueprint(item) {
  const url = glbUrlFor(item.modelAsset)
  if (!url) return
  const model = await stage.objectManager.loadGLTFModel(url, {}, { stackable: !!item.canBeStackedOn, snapsToSimilar: !!item.snapsToSimilar, customData: { name: item.name } })
  // place at origin (box controls the position)
  const box = stage.getByUniqueId(model.boxId)
  if (box) {
    box.setPosition(0, null, 0)
    attachSelection(box)
    // track list entry
    // Annotate with blueprint metadata for export by ID
    box.meta = { id: item.id, name: item.name }
    items.value.push({ id: box.uniqueId, name: item.name, box })
  }
}

function toDegrees(rad) { return rad * 180 / Math.PI }
function round(n, dec = 3) { const f = Math.pow(10, dec); return Math.round(n * f) / f }
function getBlueprintIdForBox(box) {
  if (box?.meta?.id != null) return box.meta.id
  const bp = appData.value.itemBlueprints.find(b => b.name === box?.name)
  return bp?.id
}

function onExportJson() {
  // stable order by items panel
  const list = items.value.map(it => it.box)
  const i = list.map(b => getBlueprintIdForBox(b))
  const p = list.map(b => [round(b.position.x), round(b.position.y), round(b.position.z)])
  const r = list.map(b => [
    round(toDegrees(b.rotation.x), 2),
    round(toDegrees(b.rotation.y), 2),
    round(toDegrees(b.rotation.z), 2),
  ])
  const payload = { v: 2, i, p, r }
  const json = JSON.stringify(payload)
  const blob = new Blob([json], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'ketchup.json'
  a.click()
}

async function onImportJson(text) {
  try {
    const data = JSON.parse(text)
    // clear existing items
    detachSelection()
    for (const it of [...items.value]) {
      stage.objectManager.remove(it.box)
    }
    items.value = []
    // v2 compact format: { v:2, i:[ids], p:[[x,y,z]], r:[[rx,ry,rz]] }
    if (data && data.v === 2 && Array.isArray(data.i)) {
      for (let i = 0; i < data.i.length; i++) {
        const id = data.i[i]
        const pos = Array.isArray(data.p?.[i]) ? data.p[i] : [0, null, 0]
        const rot = Array.isArray(data.r?.[i]) ? data.r[i] : [0,0,0]
        const bp = appData.value.itemBlueprints.find(b => b.id === id)
        const url = bp?.modelAsset ? glbUrlFor(bp.modelAsset) : null
        if (!url) continue
        const model = await stage.objectManager.loadGLTFModel(url, {}, { stackable: !!bp?.canBeStackedOn, snapsToSimilar: !!bp?.snapsToSimilar, customData: { name: bp?.name || String(id) } })
        const box = stage.getByUniqueId(model.boxId)
        if (!box) continue
        box.meta = { id: bp?.id, name: bp?.name }
        box.setPosition(pos[0] ?? 0, pos[1] ?? null, pos[2] ?? 0)
        // rotations in degrees
        box.rotation.x = (rot[0] ?? 0) * Math.PI / 180
        box.setRotation(rot[1] ?? 0)
        box.rotation.z = (rot[2] ?? 0) * Math.PI / 180
        box.dispatchEvent({type:'change'})
        items.value.push({ id: box.uniqueId, name: bp?.name || String(id), box })
      }
    }
    // v1 compact format: { v:1, m:[names], p:[[x,y,z]], r:[[rx,ry,rz]] }
    else if (data && data.v === 1 && Array.isArray(data.m)) {
      for (let i = 0; i < data.m.length; i++) {
        const name = data.m[i]
        const pos = Array.isArray(data.p?.[i]) ? data.p[i] : [0, null, 0]
        const rot = Array.isArray(data.r?.[i]) ? data.r[i] : [0,0,0]
        const bp = appData.value.itemBlueprints.find(b => b.name === name)
        const url = bp?.modelAsset ? glbUrlFor(bp.modelAsset) : null
        if (!url) continue
        const model = await stage.objectManager.loadGLTFModel(url, {}, { stackable: !!bp?.canBeStackedOn, snapsToSimilar: !!bp?.snapsToSimilar, customData: { name: name } })
        const box = stage.getByUniqueId(model.boxId)
        if (!box) continue
        box.meta = { id: bp?.id, name: bp?.name }
        box.setPosition(pos[0] ?? 0, pos[1] ?? null, pos[2] ?? 0)
        // rotations in degrees
        box.rotation.x = (rot[0] ?? 0) * Math.PI / 180
        box.setRotation(rot[1] ?? 0)
        box.rotation.z = (rot[2] ?? 0) * Math.PI / 180
        box.dispatchEvent({type:'change'})
        items.value.push({ id: box.uniqueId, name, box })
      }
    }
    // legacy format fallback
    else if (Array.isArray(data.models)) {
      for (const m of data.models) {
        const bp = appData.value.itemBlueprints.find(b => b.name === m.name)
        const url = bp?.modelAsset ? glbUrlFor(bp.modelAsset) : null
        if (!url) continue
        const model = await stage.objectManager.loadGLTFModel(url, {}, { stackable: !!bp?.canBeStackedOn, snapsToSimilar: !!bp?.snapsToSimilar, customData: { name: bp?.name || m.name } })
        const box = stage.getByUniqueId(model.boxId)
        if (!box) continue
        box.setPosition(m.x ?? 0, m.y ?? null, m.z ?? 0)
        if (typeof m.rotation === 'number') box.setRotation(m.rotation)
        items.value.push({ id: box.uniqueId, name: bp?.name || m.name, box })
      }
    }
  } catch (e) {
    console.error('Failed to import JSON', e)
  }
}

function onExportPng() {
  // render a square thumbnail by resizing temporarily
  const canvas = stage.renderer.domElement
  // hide gizmo while exporting
  const wasAttached = !!(transformControls && transformControls.object)
  if (transformControls) transformControls.visible = false
  // hide floor while exporting
  const floor = stage.scene.getObjectByName('ground')
  const prevFloorVis = floor?.visible ?? true
  if (floor) floor.visible = false
  const url = canvas.toDataURL('image/png')
  if (transformControls && wasAttached) transformControls.visible = true
  if (floor) floor.visible = prevFloorVis
  const a = document.createElement('a')
  a.href = url
  a.download = 'ketchup.png'
  a.click()
}

function onResetPosition() {
  if (!selectedBox.value) return
  selectedBox.value.setPosition(0, null, 0)
}

function onResetRotation() {
  if (!selectedBox.value) return
  selectedBox.value.setRotation(0)
  selectedBox.value.rotation.x = 0
  selectedBox.value.rotation.z = 0
  selectedBox.value.dispatchEvent({ type: 'change' })
}

function belongsToGizmo(obj) {
  if (!gizmoRoot && !transformControls) return false
  while (obj) {
    if (obj === gizmoRoot || obj === transformControls) return true
    const n = obj.name || ''
    const t = obj.type || ''
    if (n.includes('TransformControls') || t.includes('TransformControls')) return true
    obj = obj.parent
  }
  return false
}

function onToggleFloor() {
  const floor = stage.scene.getObjectByName('ground')
  if (!floor) return
  const next = !floor.visible
  floor.visible = next
  floorVisible.value = next
}
</script>

<template>
  <div class="layout">
    <EditorSidebar :bg-color="bgColor" :blueprints="appData.itemBlueprints" :mode="mode" :selected-name="selectedBox?.name || ''" @update:bgColor="(v) => (bgColor = v)" @update:mode="(v)=>{ mode=v }" @add="onAddBlueprint" @export-json="onExportJson" @import-json="onImportJson" @export-png="onExportPng" @reset-camera="()=> stage?.controlsManager?.resetCameraPosition?.()" />
    <main class="stage" ref="stageContainer" />
    <SceneItemsPanel :items="items" :selected-id="selectedBox?.uniqueId || null" :floor-visible="floorVisible" @toggle-floor="onToggleFloor" @select="(id)=>{ if(selectedBox?.uniqueId===id){ detachSelection(); } else { const it=items.find(i=>i.id===id); if(it) attachSelection(it.box) } }" @delete="(id)=>{ const idx=items.findIndex(i=>i.id===id); if(idx>-1){ const it=items[idx]; if(selectedBox?.uniqueId===id) detachSelection(); stage.objectManager.remove(it.box); items.splice(idx,1) } }" @reset-pos="(id)=>{ const it=items.find(i=>i.id===id); if(it) it.box.setPosition(0,null,0) }" @reset-rot="(id)=>{ const it=items.find(i=>i.id===id); if(it){ it.box.setRotation(0); it.box.rotation.x=0; it.box.rotation.z=0; it.box.dispatchEvent({type:'change'}) } }" />
  </div>
  
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  grid-template-rows: 100vh;
  height: 100vh;
}
.stage {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
