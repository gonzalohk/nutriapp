/// <reference lib="webworker" />
import { AppError } from './errors'
import { compressWithCanvas } from './photo-codec'

self.onmessage = async (event: MessageEvent<{ file: Blob }>) => {
  try {
    const result = await compressWithCanvas(event.data.file)
    self.postMessage({ ok: true, result })
  } catch (error) {
    self.postMessage({ ok: false, code: error instanceof AppError ? error.code : 'photo.unreadable' })
  }
}
