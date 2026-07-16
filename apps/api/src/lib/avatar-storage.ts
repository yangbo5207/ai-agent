import { uuidv7 } from 'uuidv7'
import { BizCode } from '@repo/contracts'
import { AppError } from './app-error'

const avatarMaxBytes = 2 * 1024 * 1024
const generatedImageMaxBytes = 20 * 1024 * 1024
const agentImageMinWidth = 720
const agentImageMinHeight = 1080
const agentImageAspectRatio = 2 / 3
const agentImageAspectRatioTolerance = 0.045

const avatarExtensionByMimeType: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

type ImageDimensions = {
  width: number
  height: number
}

export function assertAvatarFile(file: File) {
  const extension = avatarExtensionByMimeType[file.type]

  if (!extension) {
    throw new AppError(
      BizCode.COMMON_INVALID_REQUEST,
      'Avatar must be a JPG, PNG, or WebP image',
      400,
    )
  }

  if (file.size <= 0) {
    throw new AppError(
      BizCode.COMMON_INVALID_REQUEST,
      'Avatar file is empty',
      400,
    )
  }

  if (file.size > avatarMaxBytes) {
    throw new AppError(
      BizCode.COMMON_INVALID_REQUEST,
      'Avatar file must be 2MB or smaller',
      400,
    )
  }

  return extension
}

export function buildDefaultAvatarKey(file: File, nowMs: number) {
  const extension = assertAvatarFile(file)
  return `avatars/default/${nowMs}-${uuidv7()}.${extension}`
}

export function buildUserAvatarKey(userId: string, file: File, nowMs: number) {
  const extension = assertAvatarFile(file)
  return `avatars/users/${userId}/${nowMs}-${uuidv7()}.${extension}`
}

export function buildAgentImageKey(userId: string, file: File, nowMs: number) {
  const extension = assertAvatarFile(file)
  return `avatars/agents/${userId}/${nowMs}-${uuidv7()}.${extension}`
}

export function buildGeneratedImageKey(userId: string, extension: string, nowMs: number) {
  return `images/generated/${userId}/${nowMs}-${uuidv7()}.${extension}`
}

function readPngDimensions(bytes: Uint8Array, view: DataView): ImageDimensions | null {
  const isPng =
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a

  if (!isPng) {
    return null
  }

  return {
    width: view.getUint32(16, false),
    height: view.getUint32(20, false),
  }
}

function isJpegSofMarker(marker: number) {
  return (
    marker === 0xc0 ||
    marker === 0xc1 ||
    marker === 0xc2 ||
    marker === 0xc3 ||
    marker === 0xc5 ||
    marker === 0xc6 ||
    marker === 0xc7 ||
    marker === 0xc9 ||
    marker === 0xca ||
    marker === 0xcb ||
    marker === 0xcd ||
    marker === 0xce ||
    marker === 0xcf
  )
}

function readJpegDimensions(bytes: Uint8Array, view: DataView): ImageDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null
  }

  let offset = 2

  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1
      continue
    }

    while (bytes[offset] === 0xff) {
      offset += 1
    }

    const marker = bytes[offset]
    offset += 1

    if (marker === 0xd9 || marker === 0xda) {
      break
    }

    if (marker >= 0xd0 && marker <= 0xd7) {
      continue
    }

    if (offset + 2 > bytes.length) {
      break
    }

    const length = view.getUint16(offset, false)

    if (length < 2 || offset + length > bytes.length) {
      break
    }

    if (isJpegSofMarker(marker) && length >= 7) {
      return {
        height: view.getUint16(offset + 3, false),
        width: view.getUint16(offset + 5, false),
      }
    }

    offset += length
  }

  return null
}

function readAscii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.slice(offset, offset + length))
}

function readWebpDimensions(bytes: Uint8Array, view: DataView): ImageDimensions | null {
  if (bytes.length < 30 || readAscii(bytes, 0, 4) !== 'RIFF' || readAscii(bytes, 8, 4) !== 'WEBP') {
    return null
  }

  let offset = 12

  while (offset + 8 <= bytes.length) {
    const chunkType = readAscii(bytes, offset, 4)
    const chunkSize = view.getUint32(offset + 4, true)
    const dataOffset = offset + 8

    if (dataOffset + chunkSize > bytes.length) {
      break
    }

    if (chunkType === 'VP8X' && chunkSize >= 10) {
      return {
        width:
          1 +
          bytes[dataOffset + 4] +
          (bytes[dataOffset + 5] << 8) +
          (bytes[dataOffset + 6] << 16),
        height:
          1 +
          bytes[dataOffset + 7] +
          (bytes[dataOffset + 8] << 8) +
          (bytes[dataOffset + 9] << 16),
      }
    }

    if (chunkType === 'VP8L' && chunkSize >= 5 && bytes[dataOffset] === 0x2f) {
      return {
        width: 1 + bytes[dataOffset + 1] + ((bytes[dataOffset + 2] & 0x3f) << 8),
        height:
          1 +
          ((bytes[dataOffset + 2] & 0xc0) >> 6) +
          (bytes[dataOffset + 3] << 2) +
          ((bytes[dataOffset + 4] & 0x0f) << 10),
      }
    }

    if (
      chunkType === 'VP8 ' &&
      chunkSize >= 10 &&
      bytes[dataOffset + 3] === 0x9d &&
      bytes[dataOffset + 4] === 0x01 &&
      bytes[dataOffset + 5] === 0x2a
    ) {
      return {
        width: view.getUint16(dataOffset + 6, true) & 0x3fff,
        height: view.getUint16(dataOffset + 8, true) & 0x3fff,
      }
    }

    offset = dataOffset + chunkSize + (chunkSize % 2)
  }

  return null
}

function readImageDimensions(input: ArrayBuffer): ImageDimensions | null {
  const bytes = new Uint8Array(input)
  const view = new DataView(input)

  return readPngDimensions(bytes, view) ?? readJpegDimensions(bytes, view) ?? readWebpDimensions(bytes, view)
}

function assertAgentImageDimensions(dimensions: ImageDimensions | null) {
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
    throw new AppError(
      BizCode.COMMON_INVALID_REQUEST,
      'Agent image must be a valid JPG, PNG, or WebP file',
      400,
    )
  }

  if (dimensions.width < agentImageMinWidth || dimensions.height < agentImageMinHeight) {
    throw new AppError(
      BizCode.COMMON_INVALID_REQUEST,
      `Agent image must be at least ${agentImageMinWidth} x ${agentImageMinHeight}px`,
      400,
    )
  }

  if (Math.abs(dimensions.width / dimensions.height - agentImageAspectRatio) > agentImageAspectRatioTolerance) {
    throw new AppError(
      BizCode.COMMON_INVALID_REQUEST,
      'Agent image aspect ratio must be close to 2:3',
      400,
    )
  }
}

export function assertAgentImageFile(file: File, input: ArrayBuffer) {
  const extension = assertAvatarFile(file)
  const dimensions = readImageDimensions(input)

  assertAgentImageDimensions(dimensions)

  return {
    extension,
    dimensions,
  }
}

export function assertGeneratedImageFile(file: File, input: ArrayBuffer) {
  const extension = avatarExtensionByMimeType[file.type]
  const dimensions = readImageDimensions(input)

  if (!extension || !dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
    throw new AppError(
      BizCode.COMMON_INVALID_REQUEST,
      'Generated image must be a valid JPG, PNG, or WebP file',
      400,
    )
  }

  if (file.size <= 0) {
    throw new AppError(BizCode.COMMON_INVALID_REQUEST, 'Generated image file is empty', 400)
  }

  if (file.size > generatedImageMaxBytes) {
    throw new AppError(
      BizCode.COMMON_INVALID_REQUEST,
      'Generated image file must be 20MB or smaller',
      400,
    )
  }

  return {
    extension,
    dimensions,
  }
}
