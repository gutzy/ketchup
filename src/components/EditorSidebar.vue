<script setup>
import { ref, watch } from 'vue'
import ItemsPanel from './ItemsPanel.vue'

const props = defineProps({
  bgColor: { type: String, default: '#2b2b2b' },
  blueprints: { type: Array, default: () => [] },
  mode: { type: String, default: 'translate' },
  selectedName: { type: String, default: '' }
})
const emit = defineEmits(['load', 'export-json', 'export-png', 'import-json', 'update:bgColor', 'add', 'update:mode', 'reset-camera'])

const fileEl = ref(null)
function pickJson() { fileEl?.value?.click() }
function onFile(e) {
  const f = e.target.files && e.target.files[0]
  if (!f) return
  const reader = new FileReader()
  reader.onload = () => emit('import-json', reader.result)
  reader.readAsText(f)
  e.target.value = ''
}

const bg = ref(props.bgColor)
watch(bg, (v) => emit('update:bgColor', v))
</script>

<template>
  <aside class="sidebar">
    <h3>Ketchup</h3>
    <ItemsPanel :blueprints="blueprints" @add="(bp) => $emit('add', bp)" />
    <div class="row compact">
      <button :class="{active: mode==='translate'}" @click="$emit('update:mode','translate')">Move</button>
      <button :class="{active: mode==='rotate'}" @click="$emit('update:mode','rotate')">Rotate</button>
    </div>
    <div class="row compact">
      <button @click="$emit('reset-camera')">Reset Camera</button>
    </div>
    <div class="row compact">
      <button @click="pickJson">Import JSON</button>
      <button @click="$emit('export-json')">Export JSON</button>
      <button @click="$emit('export-png')">Export PNG</button>
    </div>
    <input ref="fileEl" type="file" accept="application/json" style="display:none" @change="onFile" />
    <div class="spacer" />
    <label>Background</label>
    <input type="color" v-model="bg" />
  </aside>
</template>

<style scoped>
.sidebar {
  background: #191919;
  color: #fff;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sidebar h3 { margin: 0 0 6px; font-size: 16px; font-weight: 700; }
.row { display: flex; gap: 6px; }
.row.compact button { padding: 4px 6px; font-size: 12px; border-radius: 5px; }
.sel { flex: 1; font-size: 12px; color: #bbb; align-self: center; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.spacer { flex: 1; }
button {
  background: #333;
  color: #fff;
  border: 1px solid #444;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 13px;
}
button.active { background: #555; border-color: #777; }
button:hover { background: #3a3a3a; }
</style>


