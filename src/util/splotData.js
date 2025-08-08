export async function loadAllDataSets() {
  const time = Date.now()
  const base = 'https://massgrave.me/splot2/data/'

  const fetchCsv = async (path) => {
    const res = await fetch(`${base}${path}?v=${time}`)
    const text = await res.text()
    const rows = text.replace(/\r/g, '').split('\n').map((it) => it.trim()).filter(Boolean)
    const headers = rows[0].split(',').map((it) => it.trim())
    const data = []
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i].split(',')
      const obj = {}
      for (let j = 0; j < headers.length; j++) obj[headers[j]] = row[j]
      data.push(obj)
    }
    return data
  }

  const itemBlueprintsRaw = await fetchCsv('itemBlueprints.csv')
  const inputCh = await fetchCsv('inputChannelBlueprints.csv')
  const outputCh = await fetchCsv('outputChannelBlueprints.csv')
  const enums = await fetchCsv('enums.csv')
  const categorySettings = await fetchCsv('categorySettings.csv')
  const backline = await fetchCsv('backlineItemBlueprints.csv').catch(() => [])

  const enumsMap = {}
  for (const row of enums) {
    for (const k in row) {
      if (!row[k]) continue
      if (!enumsMap[k]) enumsMap[k] = []
      enumsMap[k].push(row[k])
    }
  }
  if (enumsMap['StandType']) enumsMap['StandType'] = enumsMap['StandType'].map((s) => s.toLowerCase())

  const itemBlueprints = itemBlueprintsRaw
    .filter((it) => !!it.name)
    .filter((it) => it.done === 'TRUE')
    .map((it) => ({
      ...it,
      id: it.id && it.id * 1,
      canBeStackedOn: it.canBeStackedOn && it.canBeStackedOn.toLowerCase().includes('true'),
      snapsToSimilar: it.canBeStackedOn && it.canBeStackedOn.toLowerCase().includes('true'),
    }))

  for (const ib of itemBlueprints) {
    ib.inputs = inputCh
      .filter((it) => it.itemId && it.itemId * 1 === ib.id)
      .map((it) => ({
        name: it.name,
        deviceType: it.inputDeviceTypeConstraint,
        id: it.id && it.id * 1,
        itemName: it.itemName,
        standType: it.defaultStandType && it.defaultStandType.replace(/\r/g, '').toLowerCase(),
      }))
    ib.outputs = outputCh.filter((it) => it.itemId && it.itemId * 1 === ib.id)
    ib.backline = (backline || []).filter((it) => it.itemId && it.itemId * 1 === ib.id)
  }

  return { itemBlueprints, enums: enumsMap, categorySettings }
}

export function glbUrlFor(modelAsset) {
  if (!modelAsset) return null
  return `https://massgrave.me/splot2/models/GLB/${modelAsset}.glb`
}

export function pngUrlFor(modelAsset) {
  if (!modelAsset) return null
  return `https://massgrave.me/splot2/models/PNG/${modelAsset}.png`
}


