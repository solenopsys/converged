import React, { useRef, useEffect, useState } from 'react';

import { Button } from 'front-core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'front-core';
import { Slider } from 'front-core';
import { Badge } from 'front-core';
import { Separator } from 'front-core';
import { Alert, AlertDescription } from 'front-core';

const WaveSurferStereoPlayer = ({ leftChannelBuffer, rightChannelBuffer }) => {
  const waveformRef = useRef(null);
  const waveSurferRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState([1]);

  // Функция для создания стерео AudioBuffer из двух моно буферов
  const createStereoBuffer = (leftBuffer, rightBuffer) => {
    if (!leftBuffer || !rightBuffer) return null;
    
    const audioContext = audioContextRef.current;
    const length = Math.max(leftBuffer.length, rightBuffer.length);
    const sampleRate = 44100; // Стандартная частота дискретизации
    
    // Создаем стерео буфер
    const stereoBuffer = audioContext.createBuffer(2, length, sampleRate);
    
    // Копируем данные в левый и правый каналы
    const leftChannel = stereoBuffer.getChannelData(0);
    const rightChannel = stereoBuffer.getChannelData(1);
    
    // Заполняем каналы данными из моно буферов
    for (let i = 0; i < length; i++) {
      leftChannel[i] = i < leftBuffer.length ? leftBuffer[i] : 0;
      rightChannel[i] = i < rightBuffer.length ? rightBuffer[i] : 0;
    }
    
    return stereoBuffer;
  };

  // Инициализация аудио контекста
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Обработка буферов и создание визуализации
  useEffect(() => {
    if (leftChannelBuffer && rightChannelBuffer && audioContextRef.current) {
      const stereoBuffer = createStereoBuffer(leftChannelBuffer, rightChannelBuffer);
      if (stereoBuffer) {
        setDuration(stereoBuffer.duration);
        // Здесь можно добавить логику для создания waveform визуализации
        // Для простоты используем canvas для отрисовки
        drawWaveform(leftChannelBuffer, rightChannelBuffer);
      }
    }
  }, [leftChannelBuffer, rightChannelBuffer]);

  // Функция отрисовки waveform
  const drawWaveform = (leftData, rightData) => {
    if (!waveformRef.current) return;
    
    const canvas = waveformRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    // Настройки отрисовки
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    
    const drawChannel = (data, yOffset, color) => {
      ctx.strokeStyle = color;
      ctx.beginPath();
      
      const step = Math.ceil(data.length / width);
      const amp = height / 4;
      
      for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;
        
        for (let j = 0; j < step; j++) {
          const datum = data[(i * step) + j];
          if (datum < min) min = datum;
          if (datum > max) max = datum;
        }
        
        ctx.moveTo(i, (1 + min) * amp + yOffset);
        ctx.lineTo(i, (1 + max) * amp + yOffset);
      }
      
      ctx.stroke();
    };
    
    // Рисуем левый канал (верхняя половина)
    drawChannel(leftData, 0, '#ef4444');
    
    // Рисуем правый канал (нижняя половина)
    drawChannel(rightData, height / 2, '#3b82f6');
    
    // Линия разделения каналов
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  };

  const play = async () => {
    if (!leftChannelBuffer || !rightChannelBuffer || !audioContextRef.current) return;
    
    // Убеждаемся что AudioContext запущен
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    
    // Останавливаем предыдущее воспроизведение
    stop();
    
    const stereoBuffer = createStereoBuffer(leftChannelBuffer, rightChannelBuffer);
    if (!stereoBuffer) return;
    
    // Создаем source node
    sourceNodeRef.current = audioContextRef.current.createBufferSource();
    sourceNodeRef.current.buffer = stereoBuffer;
    
    // Создаем gain node для управления громкостью
    const gainNode = audioContextRef.current.createGain();
    gainNode.gain.value = volume[0];
    
    // Подключаем audio graph
    sourceNodeRef.current.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);
    
    // Обработчик окончания воспроизведения
    sourceNodeRef.current.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    
    sourceNodeRef.current.start(0);
    setIsPlaying(true);
    
    // Обновление текущего времени
    const startTime = audioContextRef.current.currentTime;
    const updateTime = () => {
      if (isPlaying && sourceNodeRef.current) {
        const elapsed = audioContextRef.current.currentTime - startTime;
        setCurrentTime(Math.min(elapsed, duration));
        requestAnimationFrame(updateTime);
      }
    };
    updateTime();
  };

  const pause = () => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
  };

  const stop = () => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="h-5 w-5" />
          Stereo Audio Player
        </CardTitle>
        <CardDescription>
          Dual channel audio playback with waveform visualization
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Waveform Display */}
        <div className="relative bg-muted rounded-lg p-4">
          <canvas
            ref={waveformRef}
            width={800}
            height={200}
            className="w-full h-48 rounded border"
          />
          <div className="absolute top-4 left-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <Badge variant="secondary" className="text-xs">Left Channel</Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <Badge variant="secondary" className="text-xs">Right Channel</Badge>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              onClick={isPlaying ? pause : play}
              disabled={!leftChannelBuffer || !rightChannelBuffer}
              size="lg"
              className="rounded-full"
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>
            
            <Button
              onClick={stop}
              disabled={!leftChannelBuffer || !rightChannelBuffer}
              variant="outline"
              size="lg"
              className="rounded-full"
            >
              <Square className="h-5 w-5" />
            </Button>
            
            <div className="text-sm font-mono text-muted-foreground">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-3">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <div className="w-24">
              <Slider
                value={volume}
                onValueChange={setVolume}
                max={1}
                step={0.1}
                className="w-full"
              />
            </div>
            <span className="text-sm text-muted-foreground w-10 text-right">
              {Math.round(volume[0] * 100)}%
            </span>
          </div>
        </div>

        <Separator />

        {/* Status */}
        <div className="text-center">
          {!leftChannelBuffer || !rightChannelBuffer ? (
            <Alert>
              <AlertDescription>
                Waiting for audio buffers to be loaded...
              </AlertDescription>
            </Alert>
          ) : (
            <Badge variant="outline" className="text-sm">
              Ready to play • Duration: {formatTime(duration)}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Пример использования с демо данными
const WaveSurferDemo = () => {
  const [leftBuffer, setLeftBuffer] = useState(null);
  const [rightBuffer, setRightBuffer] = useState(null);
  const [leftFileName, setLeftFileName] = useState('');
  const [rightFileName, setRightFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const leftFileInputRef = useRef(null);
  const rightFileInputRef = useRef(null);

  // Функция декодирования аудио файла
  const decodeAudioFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const audioBuffer = await audioContext.decodeAudioData(e.target.result);
          
          // Получаем данные первого канала (или создаем моно из стерео)
          const channelData = audioBuffer.getChannelData(0);
          resolve(channelData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  // Обработчик загрузки левого канала
  const handleLeftFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setIsLoading(true);
    try {
      const buffer = await decodeAudioFile(file);
      setLeftBuffer(buffer);
      setLeftFileName(file.name);
    } catch (error) {
      alert('Error loading left channel: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Обработчик загрузки правого канала
  const handleRightFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setIsLoading(true);
    try {
      const buffer = await decodeAudioFile(file);
      setRightBuffer(buffer);
      setRightFileName(file.name);
    } catch (error) {
      alert('Error loading right channel: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Генерация демо данных (синусоидальные волны разной частоты)
  const generateDemoBuffers = () => {
    const sampleRate = 44100;
    const duration = 3; // 3 секунды
    const length = sampleRate * duration;
    
    // Левый канал - 440 Hz (нота A)
    const leftData = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      leftData[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.3;
    }
    
    // Правый канал - 880 Hz (нота A на октаву выше)
    const rightData = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      rightData[i] = Math.sin(2 * Math.PI * 880 * i / sampleRate) * 0.3;
    }
    
    setLeftBuffer(leftData);
    setRightBuffer(rightData);
    setLeftFileName('Demo 440Hz');
    setRightFileName('Demo 880Hz');
  };

  // Очистка всех данных
  const clearAll = () => {
    setLeftBuffer(null);
    setRightBuffer(null);
    setLeftFileName('');
    setRightFileName('');
    if (leftFileInputRef.current) leftFileInputRef.current.value = '';
    if (rightFileInputRef.current) rightFileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            WaveSurfer Stereo Player
          </h1>
          <p className="text-lg text-muted-foreground">
            Upload and play dual-channel audio with real-time waveform visualization
          </p>
        </div>
        
        {/* File Upload Panel */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Audio File Upload
            </CardTitle>
            <CardDescription>
              Select two mono audio files for left and right channels
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Left Channel */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Left Channel</label>
                <input
                  ref={leftFileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleLeftFileChange}
                  disabled={isLoading}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
                {leftFileName && (
                  <Badge variant="outline" className="text-green-700 bg-green-50 border-green-200">
                    ✓ {leftFileName}
                  </Badge>
                )}
              </div>

              {/* Right Channel */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Right Channel</label>
                <input
                  ref={rightFileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleRightFileChange}
                  disabled={isLoading}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
                {rightFileName && (
                  <Badge variant="outline" className="text-green-700 bg-green-50 border-green-200">
                    ✓ {rightFileName}
                  </Badge>
                )}
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex flex-wrap gap-3 mt-6 justify-center">
              <Button
                onClick={generateDemoBuffers}
                disabled={isLoading}
                variant="outline"
              >
                <Music className="h-4 w-4 mr-2" />
                Generate Demo Signals
              </Button>
              
              <Button
                onClick={clearAll}
                disabled={isLoading}
                variant="outline"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center mt-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin"></div>
                  Loading and processing file...
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Player */}
        <WaveSurferStereoPlayer 
          leftChannelBuffer={leftBuffer}
          rightChannelBuffer={rightBuffer}
        />
        
        {/* Instructions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>How to Use</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <ul className="space-y-2 text-muted-foreground">
              <li><strong>File Upload:</strong> Select two mono audio files for left and right channels</li>
              <li><strong>Supported Formats:</strong> MP3, WAV, OGG, M4A and other browser-supported formats</li>
              <li><strong>Demo Mode:</strong> Click "Generate Demo Signals" to test with sine wave tones</li>
              <li><strong>Visualization:</strong> Red waveform shows left channel, blue shows right channel</li>
              <li><strong>Controls:</strong> Play/Pause/Stop playback and adjust volume</li>
            </ul>
            
            <Alert className="mt-4">
              <AlertDescription>
                <strong>Note:</strong> If you upload stereo files, the component will use only the first channel of each file.
                For best results, use mono files for each channel.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WaveSurferDemo;