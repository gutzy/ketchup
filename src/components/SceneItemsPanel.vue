<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
  selectedId: { type: [Number, String, null], default: null },
  floorVisible: { type: Boolean, default: true },
})
const emit = defineEmits(['select', 'delete', 'reset-pos', 'reset-rot', 'toggle-floor'])

const dragging = ref(false)
const pos = ref({ x: 320, y: 16 })
const offset = ref({ x: 0, y: 0 })

function onMouseDown(e) { dragging.value = true; offset.value = { x: e.clientX - pos.value.x, y: e.clientY - pos.value.y } }
function onMouseMove(e) { if (!dragging.value) return; pos.value = { x: e.clientX - offset.value.x, y: e.clientY - offset.value.y } }
function onMouseUp() { dragging.value = false }

onMounted(() => {
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
})
</script>

<template>
  <div class="floating" :style="{ left: pos.x + 'px', top: pos.y + 'px' }">
    <div class="header" @mousedown.prevent.stop="onMouseDown">Objects</div>
    <div class="list">
      <div class="row floor">
        <span class="name">Floor</span>
        <div class="actions">
          <button @click.stop="emit('toggle-floor')">{{ floorVisible ? 'Hide' : 'Show' }}</button>
        </div>
      </div>
      <div v-for="it in items" :key="it.id" class="row" :class="{selected: it.id===selectedId}" @click="emit('select', it.id)">
        <span class="name">{{ it.name }}</span>
        <div class="actions">
          <button title="Reset position" @click.stop="emit('reset-pos', it.id)">Pos</button>
          <button title="Reset rotation" @click.stop="emit('reset-rot', it.id)">Rot</button>
          <button title="Delete" class="danger" @click.stop="emit('delete', it.id)">✕</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.floating { position: absolute; z-index: 10; width: 260px; background: #161616; border: 1px solid #2a2a2a; border-radius: 8px; box-shadow: 0 6px 20px rgba(0,0,0,0.35); user-select: none; }
.header { padding: 8px 10px; font-weight: 600; border-bottom: 1px solid #2a2a2a; cursor: move; }
.list { max-height: 320px; overflow: auto; }
.row { display: flex; gap: 6px; align-items: center; padding: 8px 10px; border-bottom: 1px solid #222; cursor: pointer; }
.row.floor { cursor: default; }
.row:hover { background: #1e1e1e; }
.row.selected { background: #242424; }
.name { flex: 1; font-size: 12px; color: #ddd; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.actions { display: flex; gap: 6px; }
button { padding: 4px 6px; border-radius: 6px; border: 1px solid #3a3a3a; background: #333; color: #fff; font-size: 12px; }
button:hover { background: #3a3a3a; }
button.danger { border-color: #6a2a2a; background: #4a1a1a; }
button.danger:hover { background: #5a1e1e; }
</style>


