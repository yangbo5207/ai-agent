"use client"

const databaseName = "web-image-generation-history"
const databaseVersion = 1
const historyStoreName = "generated-images"
export const localImageGenerationHistoryLimit = 40

export type LocalImageGenerationHistoryRecord = {
  id: string
  prompt: string
  styleId?: string
  styleLabel?: string
  model: string
  size: string
  quality?: string
  reasoningEffort?: string
  mimeType: string
  imageBlob: Blob
  durationMs: number
  createdAtMs: number
  uploadedKey?: string
  uploadedAtMs?: number
}

function openHistoryDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(databaseName, databaseVersion)

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(historyStoreName)) {
        const store = database.createObjectStore(historyStoreName, { keyPath: "id" })
        store.createIndex("createdAtMs", "createdAtMs")
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("无法打开本地图片历史记录。"))
  })
}

function waitForRequest<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("本地图片历史记录操作失败。"))
  })
}

function waitForTransaction(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error("本地图片历史记录操作已取消。"))
    transaction.onerror = () => reject(transaction.error ?? new Error("本地图片历史记录操作失败。"))
  })
}

export async function listLocalImageGenerationHistory() {
  const database = await openHistoryDatabase()

  try {
    const transaction = database.transaction(historyStoreName, "readonly")
    const records = await waitForRequest(
      transaction.objectStore(historyStoreName).getAll() as IDBRequest<LocalImageGenerationHistoryRecord[]>,
    )
    await waitForTransaction(transaction)

    return records.sort((left, right) => right.createdAtMs - left.createdAtMs)
  } finally {
    database.close()
  }
}

export async function saveLocalImageGenerationHistory(record: LocalImageGenerationHistoryRecord) {
  const database = await openHistoryDatabase()

  try {
    const transaction = database.transaction(historyStoreName, "readwrite")
    const store = transaction.objectStore(historyStoreName)

    await waitForRequest(store.put(record))
    const records = await waitForRequest(
      store.getAll() as IDBRequest<LocalImageGenerationHistoryRecord[]>,
    )
    const expiredRecords = records
      .sort((left, right) => right.createdAtMs - left.createdAtMs)
      .slice(localImageGenerationHistoryLimit)

    for (const expiredRecord of expiredRecords) {
      store.delete(expiredRecord.id)
    }

    await waitForTransaction(transaction)
  } finally {
    database.close()
  }
}

export async function markLocalImageGenerationHistoryUploaded(
  id: string,
  uploadedKey: string,
  uploadedAtMs: number,
) {
  const database = await openHistoryDatabase()

  try {
    const transaction = database.transaction(historyStoreName, "readwrite")
    const store = transaction.objectStore(historyStoreName)
    const record = await waitForRequest(
      store.get(id) as IDBRequest<LocalImageGenerationHistoryRecord | undefined>,
    )

    if (!record) {
      throw new Error("本地图片记录不存在。")
    }

    const updatedRecord = { ...record, uploadedKey, uploadedAtMs }
    await waitForRequest(store.put(updatedRecord))
    await waitForTransaction(transaction)

    return updatedRecord
  } finally {
    database.close()
  }
}

export async function deleteLocalImageGenerationHistory(id: string) {
  const database = await openHistoryDatabase()

  try {
    const transaction = database.transaction(historyStoreName, "readwrite")
    transaction.objectStore(historyStoreName).delete(id)
    await waitForTransaction(transaction)
  } finally {
    database.close()
  }
}
