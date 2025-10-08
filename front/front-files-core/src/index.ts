import {$filesService } from "./segments/files";
import {$storeService } from "./segments/store";
import {$owner } from "./segments/browser";



import { FilesService  } from "../../../types/files";
import {StoreService} from "../../../types/store";





// ============= Init =============
export function initFileTransfer(
  filesService: FilesService,
  storeService: StoreService,
  owner: string = 'anonymous'
) {
  $filesService.setState(filesService);
  $storeService.setState(storeService);
  $owner.setState(owner);
}

// ============= Пример использования =============
/*
import { useStore, useEvent } from 'effector-react';
import {
  initFileTransfer,
  openFilePicker,
  downloadRequested,
  pauseUpload,
  resumeUpload,
  retryChunk,
  $files,
  $chunks,
  getFileProgress
} from './file-transfer';

// 1. Инициализация с микросервисами
const filesService = new FilesServiceImpl(); // FilesService интерфейс
const storeService = new StoreServiceImpl();  // StoreService интерфейс
initFileTransfer(filesService, storeService, 'user-123');

// 2. React компонент
function FileUploader() {
  const files = useStore($files);
  const chunks = useStore($chunks);
  
  const handleOpenPicker = useEvent(openFilePicker);
  const handleDownload = useEvent(downloadRequested);
  const handlePause = useEvent(pauseUpload);
  const handleResume = useEvent(resumeUpload);
  const handleRetry = useEvent(retryChunk);
  
  return (
    <div>
      <button onClick={handleOpenPicker}>Загрузить файлы</button>
      
      {Array.from(files.values()).map(file => {
        const progress = getFileProgress(file.fileId);
        const fileChunks = Array.from(chunks.values())
          .filter(c => c.fileId === file.fileId);
        
        return (
          <div key={file.fileId}>
            <h3>{file.fileName}</h3>
            <div>Статус: {file.status}</div>
            <div>Прогресс: {progress?.progress}%</div>
            <div>Блоков: {progress?.uploaded}/{progress?.total}</div>
            
            {file.status === 'uploading' && (
              <button onClick={() => handlePause(file.fileId)}>Пауза</button>
            )}
            
            {file.status === 'paused' && (
              <button onClick={() => handleResume(file.fileId)}>Продолжить</button>
            )}
            
            {file.status === 'completed' && (
              <button onClick={() => handleDownload(file.fileId)}>Скачать</button>
            )}
            
            <div>Блоки:</div>
            {fileChunks.map(chunk => (
              <div key={chunk.chunkNumber}>
                Блок {chunk.chunkNumber}: {chunk.status}
                {chunk.status === 'failed' && (
                  <button onClick={() => handleRetry({
                    fileId: file.fileId,
                    chunkNumber: chunk.chunkNumber
                  })}>
                    Повторить
                  </button>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// 3. Архитектура потока (для понимания):
//
// UPLOAD:
// openFilePicker → fileSelected → fileInitialized
//   ↓
// compressionStarted → readFileChunkFx → compressDataFx
//   ↓ (накапливаем сжатые данные в буфер)
// compressionDataProcessed → chunkPrepared (блок 1MB)
//   ↓
// uploadChunkRequested → chunkUploadStarted → blockSaveRequested
//   ↓
// blockSaved → chunkMetadataSaveRequested → chunkUploaded
//   ↓
// nextChunkUploadRequested → ... (рекурсивно следующий блок)
//   ↓
// uploadCompleted
//
// DOWNLOAD:
// downloadRequested → fileMetadataLoadRequested → fileMetadataLoaded
//   ↓
// fileChunksLoadRequested → fileChunksLoaded → saveDialogRequested
//   ↓
// showSaveDialogFx → fileHandleReady → decompressionStarted
//   ↓
// decompressionChunkRequested → blockLoadRequested → blockLoaded
//   ↓
// decompressDataFx → decompressionChunkProcessed → writeChunkRequested
//   ↓
// writeChunkFx → chunkWritten → ... (рекурсивно следующий блок)
//   ↓
// decompressionCompleted
*/