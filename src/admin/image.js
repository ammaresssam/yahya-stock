// Shrinks a photo to max 1000px and converts it to WebP before upload,
// so product pages stay fast even if the owner uploads a 12 MB phone photo.
export async function toWebp(file, max = 1000, quality = 0.82) {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * k)
  canvas.height = Math.round(bmp.height * k)
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', quality))
  if (!blob) throw new Error('image conversion failed')
  return blob
}
