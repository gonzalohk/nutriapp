import { compressWithCanvas } from '../../src/data/photo-codec'

const tbody = document.querySelector('#out tbody')!
const previews = document.querySelector('#previews')!
const results: unknown[] = []

async function run(name: string, blob: Blob) {
  const t0 = performance.now()
  const { full, thumb } = await compressWithCanvas(blob)
  const ms = Math.round(performance.now() - t0)
  const row = {
    name, originalKB: Math.round(blob.size / 1024), resultKB: Math.round(full.blob.size / 1024), thumbKB: Math.round(thumb.size / 1024),
    width: full.width, height: full.height, mime: full.mimeType, quality: full.quality, ms,
  }
  results.push(row)
  tbody.insertAdjacentHTML('beforeend', `<tr><td>${name}</td><td>${row.originalKB}</td><td>${row.resultKB}</td><td>${row.thumbKB}</td><td>${row.width}x${row.height}</td><td>${row.mime}</td><td>${row.quality}</td><td>${ms}</td></tr>`)
  const img = document.createElement('img')
  img.src = URL.createObjectURL(full.blob)
  img.alt = name
  previews.append(img)
}

document.querySelector<HTMLInputElement>('#files')!.addEventListener('change', async (e) => {
  for (const file of (e.target as HTMLInputElement).files ?? []) await run(file.name, file)
})

// Automated mode: /tools/photo-lab/?fixture=/tests/fixtures/meal-3000x2000.jpg
const fixture = new URLSearchParams(location.search).get('fixture')
if (fixture) {
  const blob = await (await fetch(fixture)).blob()
  await run(fixture.split('/').pop()!, blob)
  const out = document.querySelector<HTMLElement>('#json')!
  out.textContent = JSON.stringify(results)
  out.hidden = false
}
