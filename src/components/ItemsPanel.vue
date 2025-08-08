<script setup>
import { computed, ref } from 'vue'
import { pngUrlFor } from '@/util/splotData'

const props = defineProps({
  blueprints: { type: Array, default: () => [] }
})
const emit = defineEmits(['add'])

const search = ref('')
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = props.blueprints.filter((b) => !!b.modelAsset)
  if (!q) return list
  return list.filter((b) => b.name?.toLowerCase().includes(q))
})

function onAdd(bp) {
  emit('add', bp)
}
</script>

<template>
  <div class="panel">
    <div class="panel__header">
      <h4>Items</h4>
      <input v-model="search" placeholder="Search items" />
    </div>
    <div class="grid">
      <div v-for="bp in filtered" :key="bp.id" class="card" @dblclick="onAdd(bp)">
        <div class="thumb" :style="{ backgroundImage: `url(${pngUrlFor(bp.modelAsset)})` }" />
        <div class="meta">
          <div class="name" :title="bp.name">{{ bp.name }}</div>
          <button class="add" @click="onAdd(bp)">Add</button>
        </div>
      </div>
    </div>
  </div>
  
</template>

<style scoped>
.panel { display: flex; flex-direction: column; gap: 8px; }
.panel__header { display: flex; gap: 8px; align-items: center; }
input { flex: 1; padding: 6px 8px; border-radius: 6px; border: 1px solid #444; background: #222; color: #fff; }
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  max-height: calc(100vh - 350px);
  overflow: auto;
  padding-right: 4px;
}
.card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; }
.thumb { width: 100%; aspect-ratio: 1/1; background-size: cover; background-position: center; background-color: #111; }
.meta { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 6px; }
.name { flex: 1; font-size: 12px; color: #ddd; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.add { padding: 6px 8px; border-radius: 6px; border: 1px solid #3a3a3a; background: #333; color: #fff; }
.add:hover { background: #3a3a3a; }
</style>


