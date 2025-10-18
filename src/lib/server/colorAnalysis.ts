import sharp from 'sharp'

import { ColorAnalysis } from '@/types/clothing'

export type ColorAlgorithm = 'legacy' | 'enhanced'

type RGB = { r: number; g: number; b: number }

interface ImageMatrix {
  data: Uint8ClampedArray
  width: number
  height: number
}

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

const BACKGROUND_DISTANCE_THRESHOLD = 48
const ROW_ACTIVITY_THRESHOLD = 0.28
const COLUMN_ACTIVITY_THRESHOLD = 0.18

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const sliceMatrix = (matrix: ImageMatrix, bounds: Bounds): ImageMatrix => {
  const { data, width } = matrix
  const { x, y, width: w, height: h } = bounds
  const sliceData = new Uint8ClampedArray(w * h * 4)

  for (let row = 0; row < h; row += 1) {
    const srcOffset = ((y + row) * width + x) * 4
    const destOffset = row * w * 4
    sliceData.set(data.subarray(srcOffset, srcOffset + w * 4), destOffset)
  }

  return { data: sliceData, width: w, height: h }
}

const isLikelySkinTone = (r: number, g: number, b: number): boolean => {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return (r > 95 && g > 40 && b > 20 && (max - min) > 15 && Math.abs(r - g) > 15 && r > g && r > b)
}

const hslFromRgb = (r: number, g: number, b: number): { h: number; s: number; l: number } => {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0)
        break
      case gn:
        h = (bn - rn) / d + 2
        break
      case bn:
        h = (rn - gn) / d + 4
        break
    }
    h /= 6
  }
  return { h: h * 360, s, l }
}

const estimateModeColor = (colors: number[]): number | null => {
  if (!colors.length) return null
  const counts = new Map<number, number>()
  for (const c of colors) {
    const qr = (c >> 16) & 0xff
    const qg = (c >> 8) & 0xff
    const qb = c & 0xff
    const quant = ((qr >> 4) << 16) | ((qg >> 4) << 8) | (qb >> 4)
    counts.set(quant, (counts.get(quant) || 0) + 1)
  }
  let best: number | null = null
  let bestCount = -1
  counts.forEach((cnt, key) => {
    if (cnt > bestCount) {
      best = key
      bestCount = cnt
    }
  })
  if (best == null) return null
  const r = ((best >> 16) & 0xff) << 4
  const g = ((best >> 8) & 0xff) << 4
  const b = (best & 0xff) << 4
  return (r << 16) | (g << 8) | b
}

const estimateBackgroundColor = (matrix: ImageMatrix): RGB | null => {
  const { data, width, height } = matrix
  const borderSamples: number[] = []
  const addSample = (x: number, y: number) => {
    const idx = (y * width + x) * 4
    const a = data[idx + 3]
    if (a < 128) return
    const r = data[idx]
    const g = data[idx + 1]
    const b = data[idx + 2]
    borderSamples.push((r << 16) | (g << 8) | b)
  }
  const stepX = Math.max(1, Math.floor(width / 50))
  const stepY = Math.max(1, Math.floor(height / 50))
  for (let x = 0; x < width; x += stepX) {
    addSample(x, 0)
    addSample(x, height - 1)
  }
  for (let y = 0; y < height; y += stepY) {
    addSample(0, y)
    addSample(width - 1, y)
  }
  const mode = estimateModeColor(borderSamples)
  if (mode == null) return null
  return {
    r: (mode >> 16) & 0xff,
    g: (mode >> 8) & 0xff,
    b: mode & 0xff,
  }
}

const focusGarmentRegion = (matrix: ImageMatrix): Bounds | null => {
  const { data, width, height } = matrix
  if (width < 60 || height < 60) {
    return null
  }
  const background = estimateBackgroundColor(matrix)
  const rowScores = new Array<number>(height).fill(0)
  const colScores = new Array<number>(width).fill(0)
  const rowTotals = new Array<number>(height).fill(0)
  const colTotals = new Array<number>(width).fill(0)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4
      const alpha = data[idx + 3]
      if (alpha < 64) continue
      rowTotals[y] += 1
      colTotals[x] += 1
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      if (background) {
        const dist = colorDistance(r, g, b, background.r, background.g, background.b)
        if (dist < BACKGROUND_DISTANCE_THRESHOLD) continue
      }
      if (isLikelySkinTone(r, g, b)) continue
      rowScores[y] += 1
      colScores[x] += 1
    }
  }

  for (let y = 0; y < height; y += 1) {
    if (rowTotals[y] > 0) {
      rowScores[y] /= rowTotals[y]
    }
  }
  for (let x = 0; x < width; x += 1) {
    if (colTotals[x] > 0) {
      colScores[x] /= colTotals[x]
    }
  }

  const minRow = Math.floor(height * 0.12)
  const maxRow = height - Math.floor(height * 0.05)
  let top = -1
  let bottom = -1
  for (let y = minRow; y < maxRow; y += 1) {
    if (rowScores[y] >= ROW_ACTIVITY_THRESHOLD) {
      top = y
      break
    }
  }
  for (let y = maxRow - 1; y >= minRow; y -= 1) {
    if (rowScores[y] >= ROW_ACTIVITY_THRESHOLD) {
      bottom = y
      break
    }
  }
  if (top === -1 || bottom === -1 || (bottom - top) < height * 0.25) {
    return null
  }

  const minCol = Math.floor(width * 0.05)
  const maxCol = width - Math.floor(width * 0.05)
  let left = -1
  let right = -1
  for (let x = minCol; x < maxCol; x += 1) {
    if (colScores[x] >= COLUMN_ACTIVITY_THRESHOLD) {
      left = x
      break
    }
  }
  for (let x = maxCol - 1; x >= minCol; x -= 1) {
    if (colScores[x] >= COLUMN_ACTIVITY_THRESHOLD) {
      right = x
      break
    }
  }
  if (left === -1 || right === -1 || (right - left) < width * 0.22) {
    return null
  }

  const marginX = Math.floor(width * 0.06)
  const marginY = Math.floor(height * 0.06)
  const cropX = clamp(left - marginX, 0, width - 1)
  const cropY = clamp(top - marginY, 0, height - 1)
  const cropWidth = Math.min(width - cropX, right - left + 1 + marginX * 2)
  const cropHeight = Math.min(height - cropY, bottom - top + 1 + marginY * 2)
  if (cropWidth < width * 0.4 || cropHeight < height * 0.3) {
    return null
  }
  if (cropWidth * cropHeight >= width * height * 0.92) {
    return null
  }
  return { x: cropX, y: cropY, width: cropWidth, height: cropHeight }
}

const extractDominantColorsLegacy = (matrix: ImageMatrix): ColorAnalysis => {
  const { data } = matrix
  const colorCounts: Record<string, number> = {}
  const totalPixels = data.length / 4

  for (let i = 0; i < data.length; i += 40) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const alpha = data[i + 3]
    if (alpha < 128) continue
    const hex = rgbToHex(r, g, b)
    colorCounts[hex] = (colorCounts[hex] || 0) + 1
  }

  const sorted = Object.entries(colorCounts).sort(([, a], [, b]) => b - a).slice(0, 5)
  const dominantColors = sorted.map(([hex]) => hex)
  const colorPercentages: Record<string, number> = {}
  sorted.forEach(([hex, count]) => { colorPercentages[hex] = (count / (totalPixels / 10)) * 100 })
  return { dominantColors, colorPercentages }
}

const extractDominantColorsEnhanced = (matrix: ImageMatrix): ColorAnalysis => {
  const { data, width, height } = matrix

  const bgColor = estimateBackgroundColor(matrix)
  const bgHue = bgColor ? hslFromRgb(bgColor.r, bgColor.g, bgColor.b).h : null

  const colorCounts: Record<string, number> = {}

  const cx = width / 2
  const cy = height / 2
  const tightRx = width * 0.22
  const tightRy = height * 0.22
  const softRx = width * 0.34
  const softRy = height * 0.30

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const idx = (y * width + x) * 4
      const a = data[idx + 3]
      if (a < 128) continue
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      const brightness = (r + g + b) / 3
      const maxc = Math.max(r, g, b)
      const minc = Math.min(r, g, b)
      const saturationApprox = maxc - minc
      const normTight = ((x - cx) * (x - cx)) / (tightRx * tightRx) + ((y - cy) * (y - cy)) / (tightRy * tightRy)
      const normSoft = ((x - cx) * (x - cx)) / (softRx * softRx) + ((y - cy) * (y - cy)) / (softRy * softRy)
      const inTightCenter = normTight <= 1
      const inSoftCenter = normSoft <= 1

      const isVeryBright = brightness > 244
      const isFlatBright = saturationApprox < 12 && brightness > 215
      const isVeryDark = brightness < 10
      if (!inSoftCenter && (isVeryBright || isVeryDark || isFlatBright)) continue
      if (!inTightCenter && isVeryBright && bgColor) {
        const distToBg = colorDistance(r, g, b, bgColor.r, bgColor.g, bgColor.b)
        if (distToBg < 28) continue
      }

      if (bgColor && !inSoftCenter) {
        const dist = colorDistance(r, g, b, bgColor.r, bgColor.g, bgColor.b)
        if (dist < 72) continue
      }

      if (isLikelySkinTone(r, g, b)) continue

      const px = hslFromRgb(r, g, b)
      if ((px.h >= 25 && px.h <= 50 && px.s < 0.35 && px.l > 0.65) || (px.s < 0.12 && px.l > 0.6)) continue
      if (bgHue != null && !inSoftCenter) {
        const dh = Math.min(Math.abs(px.h - bgHue), 360 - Math.abs(px.h - bgHue))
        if (px.s < 0.2 && dh < 24) continue
      }

      const qr = (r >> 3) << 3
      const qg = (g >> 3) << 3
      const qb = (b >> 3) << 3
      const hex = rgbToHex(qr, qg, qb)
      const satW = 1 + Math.min(3, px.s * 3.5)
      const lightBonus =
        px.l >= 0.72 && px.l <= 0.9
          ? 1 + (px.l - 0.7) * 3
          : px.l <= 0.55
            ? 1 + (0.55 - px.l)
            : 1
      const centerWeight = inTightCenter ? 16 : inSoftCenter ? 4 : 0.4
      const weight = centerWeight * satW * lightBonus
      colorCounts[hex] = (colorCounts[hex] || 0) + weight
    }
  }

  const consolidated: Record<string, number> = {}
  const threshold = 18
  const keys = Object.keys(colorCounts)
  const visited = new Set<string>()
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    if (visited.has(k)) continue
    visited.add(k)
    let count = colorCounts[k]
    let r0 = parseInt(k.slice(1, 3), 16)
    let g0 = parseInt(k.slice(3, 5), 16)
    let b0 = parseInt(k.slice(5, 7), 16)
    for (let j = i + 1; j < keys.length; j++) {
      const k2 = keys[j]
      if (visited.has(k2)) continue
      const r1 = parseInt(k2.slice(1, 3), 16)
      const g1 = parseInt(k2.slice(3, 5), 16)
      const b1 = parseInt(k2.slice(5, 7), 16)
      if (colorDistance(r0, g0, b0, r1, g1, b1) <= threshold) {
        count += colorCounts[k2]
        r0 = Math.round((r0 + r1) / 2)
        g0 = Math.round((g0 + g1) / 2)
        b0 = Math.round((b0 + b1) / 2)
        visited.add(k2)
      }
    }
    const qhex = rgbToHex((r0 >> 3) << 3, (g0 >> 3) << 3, (b0 >> 3) << 3)
    consolidated[qhex] = (consolidated[qhex] || 0) + count
  }

  const sorted = Object.entries(consolidated).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const dominantColors = sorted.map(([hex]) => hex)
  const colorPercentages: Record<string, number> = {}
  const totalCon = sorted.reduce((acc, [, c]) => acc + c, 0)
  sorted.forEach(([hex, count]) => { colorPercentages[hex] = (count / Math.max(1, totalCon)) * 100 })

  return { dominantColors, colorPercentages }
}

const colorDistance = (r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number => {
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

const rgbToHex = (r: number, g: number, b: number): string => (
  '#' + [r, g, b].map((x) => {
    const hex = x.toString(16)
    return hex.length === 1 ? `0${hex}` : hex
  }).join('')
)

const resizeForAnalysis = async (buffer: Buffer): Promise<ImageMatrix> => {
  const transformer = sharp(buffer, { failOn: 'none' })
  const { data, info } = await transformer
    .ensureAlpha()
    .resize({ width: 256, height: 256, fit: 'inside', withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true })

  const typed = new Uint8ClampedArray(
    data.buffer,
    data.byteOffset,
    data.length,
  )
  return { data: typed, width: info.width, height: info.height }
}

export async function analyzeBufferColors(
  buffer: Buffer,
  algorithm: ColorAlgorithm = 'enhanced',
): Promise<ColorAnalysis> {
  const matrix = await resizeForAnalysis(buffer)
  let working = matrix

  const bounds = focusGarmentRegion(matrix)
  if (bounds) {
    working = sliceMatrix(matrix, bounds)
  }

  return algorithm === 'enhanced'
    ? extractDominantColorsEnhanced(working)
    : extractDominantColorsLegacy(working)
}

