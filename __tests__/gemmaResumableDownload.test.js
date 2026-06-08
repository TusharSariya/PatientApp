import { File, __mockFileStore, __resetMockFileStore } from 'expo-file-system';

jest.mock('expo/fetch', () => ({
  fetch: jest.fn(),
}));

import { fetch } from 'expo/fetch';
import {
  deleteDownloadArtifacts,
  downloadGemmaModelResumable,
  getGemmaCacheFileStatus,
  readDownloadSidecar,
  writeDownloadSidecar,
} from '../src/gemma/gemmaResumableDownload';

describe('gemmaResumableDownload', () => {
  beforeEach(() => {
    __resetMockFileStore();
    fetch.mockReset();
  });

  test('downloads a model file and reports progress', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name) => (name.toLowerCase() === 'content-length' ? String(bytes.length) : null),
      },
      body: {
        getReader: () => {
          let sent = false;
          return {
            read: async () => {
              if (sent) return { done: true, value: undefined };
              sent = true;
              return { done: false, value: bytes };
            },
          };
        },
      },
    });

    const finalFile = new File('cache', 'gemma_models', 'model.litertlm');
    const partFile = new File('cache', 'gemma_models', 'model.litertlm.part');
    const sidecarFile = new File('cache', 'gemma_models', 'model.litertlm.download.json');
    const onProgress = jest.fn();

    const uri = await downloadGemmaModelResumable({
      url: 'https://example.com/model.litertlm',
      finalFile,
      partFile,
      sidecarFile,
      expectedBytes: bytes.length,
      onProgress,
    });

    expect(uri).toBe(finalFile.uri);
    expect(finalFile.exists).toBe(true);
    expect(onProgress).toHaveBeenCalledWith(1);
    expect(partFile.exists).toBe(false);
    expect(sidecarFile.exists).toBe(false);
  });

  test('resumes with range request when part file exists', async () => {
    const partFile = new File('cache', 'gemma_models', 'resume.litertlm.part');
    partFile.create({ overwrite: true });
    partFile.write(new Uint8Array([9, 9]));

    const chunk = new Uint8Array([1]);
    fetch.mockResolvedValue({
      ok: true,
      status: 206,
      headers: {
        get: (name) => {
          if (name.toLowerCase() === 'content-range') return 'bytes 2-2/3';
          if (name.toLowerCase() === 'content-length') return '1';
          return null;
        },
      },
      body: {
        getReader: () => {
          let sent = false;
          return {
            read: async () => {
              if (sent) return { done: true, value: undefined };
              sent = true;
              return { done: false, value: chunk };
            },
          };
        },
      },
    });

    const finalFile = new File('cache', 'gemma_models', 'resume.litertlm');
    const sidecarFile = new File('cache', 'gemma_models', 'resume.litertlm.download.json');
    writeDownloadSidecar(sidecarFile, {
      url: 'https://example.com/resume.litertlm',
      bytesReceived: 2,
      totalBytes: 3,
    });

    await downloadGemmaModelResumable({
      url: 'https://example.com/resume.litertlm',
      finalFile,
      partFile,
      sidecarFile,
      expectedBytes: 3,
      onProgress: jest.fn(),
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/resume.litertlm',
      expect.objectContaining({ headers: { Range: 'bytes=2-' } })
    );
    expect(finalFile.exists).toBe(true);
  });

  test('getGemmaCacheFileStatus reports partial and complete files', () => {
    const finalFile = new File('cache', 'gemma_models', 'done.litertlm');
    finalFile.create({ overwrite: true });
    finalFile.write(new Uint8Array(1000));

    expect(getGemmaCacheFileStatus({
      finalFile,
      partFile: new File('cache', 'gemma_models', 'done.litertlm.part'),
      sidecarFile: new File('cache', 'gemma_models', 'done.litertlm.download.json'),
      expectedBytes: 1000,
    })).toEqual({
      exists: true,
      bytes: 1000,
      expectedBytes: 1000,
      isComplete: true,
      isPartial: false,
    });
  });

  test('deleteDownloadArtifacts removes part, sidecar, and final files', () => {
    const finalFile = new File('cache', 'gemma_models', 'x.litertlm');
    const partFile = new File('cache', 'gemma_models', 'x.litertlm.part');
    const sidecarFile = new File('cache', 'gemma_models', 'x.litertlm.download.json');
    finalFile.create({ overwrite: true });
    partFile.create({ overwrite: true });
    sidecarFile.create({ overwrite: true });
    writeDownloadSidecar(sidecarFile, { url: 'u', bytesReceived: 1, totalBytes: 2 });

    deleteDownloadArtifacts({ finalFile, partFile, sidecarFile });

    expect(finalFile.exists).toBe(false);
    expect(partFile.exists).toBe(false);
    expect(sidecarFile.exists).toBe(false);
    expect(readDownloadSidecar(sidecarFile)).toBeNull();
  });
});
