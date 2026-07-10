import { h } from 'preact';
import type { JSX } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import {filesClient, storeClient} from './services';
import { createDomainLogger } from "effector-logger";

import { StoreService, PaginationParams, HashString } from '../../../public/types/store';



// Импорты из вашей библиотеки (замените на реальные пути)
import { $files,services,fileTransferDomain, getFileProgress, pauseUpload, resumeUpload, cancelUpload, retryChunk,fileSelected } from 'files-state';
createDomainLogger(fileTransferDomain);
services.setFilesService(filesClient);


class StoreServiceClient implements StoreService {
  save(data: Uint8Array): Promise<any>{
    const randomString = Math.random().toString(36).substring(2, 9);
    return Promise.resolve(randomString);
  }
  delete(hash: HashString): Promise<any>{
    return Promise.resolve();
  }
  get(hash: HashString): Promise<any>{
    return Promise.resolve();
  }
  list(params: PaginationParams): Promise<any>{
    return Promise.resolve();
  }
  storeStatistic(): Promise<any>{
    return Promise.resolve();
  }
  
}

const mockClient = new StoreServiceClient();
services.setStoreService(storeClient);
 
 
// Компонент для отдельного файла
function FileItem({ fileId }) {
  const [progress, setProgress] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 1;

  useEffect(() => {
    const progressStore = getFileProgress(fileId);
    setProgress(progressStore.getState());
    
    const unsubscribe = progressStore.watch((state) => {
      if (state.status !== 'error') {
        setRetryCount(0);
      }
      setProgress(state);
    });

    return unsubscribe;
  }, [fileId]);

  if (!progress) return null;

  const handlePause = () => pauseUpload(fileId);
  const handleResume = () => resumeUpload(fileId);
  const handleCancel = () => cancelUpload(fileId);
  const handleRetry = () => {
    if (retryCount < maxRetries) {
      setRetryCount(retryCount + 1);
      retryChunk({ fileId, chunkNumber: progress.failedChunk });
    }
  };

  const isRetryable = progress.status === 'error' && retryCount < maxRetries;

  return (
    <div style={{
      border: '1px solid #ddd',
      borderRadius: '6px',
      padding: '12px',
      marginBottom: '8px'
    }}>
      <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
        <strong>File {fileId}</strong>
        <span>{progress.progress}%</span>
      </div>

      {/* Прогресс бар */}
      <div style={{
        width: '100%',
        height: '8px',
        backgroundColor: '#f0f0f0',
        borderRadius: '4px',
        marginBottom: '8px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${progress.progress}%`,
          height: '100%',
          backgroundColor: progress.status === 'error' ? '#ef4444' : '#3b82f6',
          transition: 'width 0.3s'
        }} />
      </div>

      <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
        {progress.uploadedChunks} / {progress.totalChunks} chunks | Status: {progress.status}
        {progress.status === 'error' && !isRetryable && (
          <span style={{ color: '#ef4444', marginLeft: '8px' }}>Upload failed permanently.</span>
        )}
      </div>

      {/* Кнопки управления */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {progress.status === 'uploading' && (
          <button onClick={handlePause} style={buttonStyle}>⏸ Pause</button>
        )}
        
        {progress.status === 'paused' && (
          <button onClick={handleResume} style={buttonStyle}>▶ Resume</button>
        )}
        
        {isRetryable && (
          <button onClick={handleRetry} style={buttonStyle}>🔄 Retry ({maxRetries - retryCount} left)</button>
        )}
        
        <button onClick={handleCancel} style={{ ...buttonStyle, backgroundColor: '#ef4444' }}>
          ✕ Cancel
        </button>
      </div>
    </div>
  );
}

// Главный компонент
function FileUploadManager() {
  const [files, setFiles] = useState(new Map());

  useEffect(() => {
    setFiles($files.getState());
    
    const unsubscribe = $files.watch((state) => {
      setFiles(new Map(state));
    });

    return unsubscribe;
  }, []);

  const handleFileSelect = (e: JSX.TargetedEvent<HTMLInputElement, Event>) => {
    const input = e.currentTarget;
    if (!input.files) return;

    const selectedFiles = Array.from(input.files);

    selectedFiles.forEach((file: File) => {
      fileSelected(file);
    });

    // Очищаем input для повторного выбора того же файла
    input.value = '';
  };

  return (
    <div style={{ maxWidth: '600px', margin: '20px auto', padding: '20px' }}>
      <h2>File Upload Manager</h2>
      
      {/* Кнопка выбора файлов */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{
          ...buttonStyle,
          display: 'inline-block',
          cursor: 'pointer',
          backgroundColor: '#10b981'
        }}>
          📁 Select Files
          <input
            type="file"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {/* Список файлов */}
      <div>
        {files.size === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', padding: '40px' }}>
            No files selected
          </div>
        ) : (
          Array.from(files.values()).map(file => (
            <FileItem key={file.fileId} fileId={file.fileId} />
          ))
        )}
      </div>
    </div>
  );
}

const buttonStyle = {
  padding: '8px 16px',
  border: 'none',
  borderRadius: '4px',
  backgroundColor: '#3b82f6',
  color: 'white',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '500'
};

export default FileUploadManager;