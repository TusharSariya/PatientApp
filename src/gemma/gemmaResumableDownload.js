import { fetch } from 'expo/fetch';
import { Directory, File, Paths } from 'expo-file-system';

import { createStallWatcher } from './gemmaDownloadPolicy';

function logDownload(event, details = {}) {
  if (__DEV__) {
    console.log('[gemma-download]', event, details);
  }
}

const CACHE_DIR_NAME = 'gemma_models';

function parseContentRange(header) {
  if (!header) return null;
  const match = header.match(/bytes\s+(\d+)-(\d+)\/(\d+|\*)/i);
  if (!match) return null;
  const total = match[3] === '*' ? null : Number(match[3]);
  return {
    start: Number(match[1]),
    end: Number(match[2]),
    total,
  };
}

function parseTotalBytes(response, existingBytes) {
  const contentRange = parseContentRange(response.headers.get('content-range'));
  if (contentRange?.total) return contentRange.total;
  const contentLength = response.headers.get('content-length');
  if (contentLength) {
    const chunkLength = Number(contentLength);
    if (Number.isFinite(chunkLength) && chunkLength > 0) {
      return existingBytes + chunkLength;
    }
  }
  return null;
}

export function ensureGemmaCacheDirectory() {
  const dir = new Directory(Paths.cache, CACHE_DIR_NAME);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

export function readDownloadSidecar(sidecarFile) {
  if (!sidecarFile.exists) return null;
  try {
    return JSON.parse(sidecarFile.textSync());
  } catch {
    return null;
  }
}

export function writeDownloadSidecar(sidecarFile, metadata) {
  if (!sidecarFile.exists) {
    sidecarFile.create({ overwrite: true });
  }
  sidecarFile.write(JSON.stringify({
    ...metadata,
    updatedAt: Date.now(),
  }));
}

export function deleteDownloadArtifacts({ partFile, sidecarFile, finalFile }) {
  if (partFile?.exists) partFile.delete();
  if (sidecarFile?.exists) sidecarFile.delete();
  if (finalFile?.exists) finalFile.delete();
}

async function appendResponseBody(partFile, response, {
  startOffset,
  onChunk,
  signal,
}) {
  if (!response.body) {
    throw new Error(
      'Download response has no body. Streaming fetch is required (expo/fetch).'
    );
  }
  const reader = response.body.getReader();
  const handle = partFile.open();
  try {
    if (startOffset > 0) {
      handle.offset = startOffset;
    }
    while (true) {
      if (signal?.aborted) {
        throw new Error('Download cancelled.');
      }
      const { done, value } = await reader.read();
      if (done) break;
      if (value?.length) {
        handle.writeBytes(value);
        onChunk?.(value.length);
      }
    }
  } finally {
    handle.close();
  }
}

export async function downloadGemmaModelResumable({
  url,
  finalFile,
  partFile,
  sidecarFile,
  expectedBytes = null,
  onProgress,
  signal,
}) {
  ensureGemmaCacheDirectory();

  if (finalFile.exists && finalFile.size > 0) {
    const complete = !expectedBytes || finalFile.size >= expectedBytes * 0.98;
    if (complete) {
      onProgress?.(1);
      return finalFile.uri;
    }
    finalFile.delete();
  }

  let bytesReceived = partFile.exists ? partFile.size : 0;
  const sidecar = readDownloadSidecar(sidecarFile);
  if (sidecar?.url && sidecar.url !== url) {
    deleteDownloadArtifacts({ partFile, sidecarFile });
    bytesReceived = 0;
  } else if (sidecar?.bytesReceived && sidecar.bytesReceived > bytesReceived) {
    bytesReceived = sidecar.bytesReceived;
  }

  if (!partFile.exists) {
    partFile.create({ overwrite: true });
  } else if (bytesReceived === 0) {
    partFile.write(new Uint8Array());
  }

  const headers = {};
  if (bytesReceived > 0) {
    headers.Range = `bytes=${bytesReceived}-`;
  }

  logDownload('fetch-start', { url, bytesReceived, hasRange: bytesReceived > 0 });
  const response = await fetch(url, { headers, signal });
  logDownload('fetch-response', {
    status: response.status,
    hasBody: Boolean(response.body),
    contentLength: response.headers.get('content-length'),
    contentRange: response.headers.get('content-range'),
  });
  if (!response.ok) {
    throw new Error(`Model download failed: HTTP ${response.status}`);
  }

  const status = response.status;
  if (bytesReceived > 0 && status === 200) {
    partFile.delete();
    partFile.create({ overwrite: true });
    bytesReceived = 0;
    sidecarFile.exists && sidecarFile.delete();
    return downloadGemmaModelResumable({
      url,
      finalFile,
      partFile,
      sidecarFile,
      expectedBytes,
      onProgress,
      signal,
    });
  }

  let totalBytes = parseTotalBytes(response, bytesReceived) ?? sidecar?.totalBytes ?? expectedBytes;
  const stallWatcher = createStallWatcher();
  let stallReject;
  const stallPromise = new Promise((_, reject) => {
    stallReject = reject;
  });
  stallWatcher.start((error) => stallReject(error));
  stallWatcher.touch(bytesReceived / Math.max(totalBytes ?? 1, 1));
  logDownload('stream-start', { bytesReceived, totalBytes });

  try {
    await Promise.race([
      appendResponseBody(partFile, response, {
        startOffset: bytesReceived,
        onChunk: (chunkSize) => {
          bytesReceived += chunkSize;
          if (totalBytes && totalBytes > 0) {
            const progress = Math.min(1, bytesReceived / totalBytes);
            stallWatcher.touch(progress);
            onProgress?.(progress);
            writeDownloadSidecar(sidecarFile, {
              url,
              bytesReceived,
              totalBytes,
            });
          } else {
            onProgress?.(0);
          }
        },
        signal,
      }),
      stallPromise,
    ]);
  } finally {
    stallWatcher.clear();
  }

  if (totalBytes && bytesReceived < totalBytes * 0.98) {
    throw new Error(`Incomplete download (${bytesReceived} of ${totalBytes} bytes).`);
  }

  if (finalFile.exists) {
    finalFile.delete();
  }
  partFile.move(finalFile);
  if (sidecarFile.exists) {
    sidecarFile.delete();
  }
  logDownload('complete', { bytes: finalFile.size, uri: finalFile.uri });
  onProgress?.(1);
  return finalFile.uri;
}

export function getGemmaCacheFileStatus({ finalFile, partFile, sidecarFile, expectedBytes }) {
  if (finalFile.exists && finalFile.size > 0) {
    return {
      exists: true,
      bytes: finalFile.size,
      expectedBytes,
      isComplete: !expectedBytes || finalFile.size >= expectedBytes * 0.98,
      isPartial: false,
    };
  }
  const bytes = partFile.exists ? partFile.size : 0;
  const sidecar = readDownloadSidecar(sidecarFile);
  const totalBytes = sidecar?.totalBytes ?? expectedBytes ?? null;
  return {
    exists: bytes > 0,
    bytes,
    expectedBytes: totalBytes,
    isComplete: false,
    isPartial: bytes > 0,
  };
}
