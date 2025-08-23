import { Elysia } from 'elysia'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const getMimeType = (filename) => {
  if (filename.endsWith('.js')) return 'application/javascript'
  if (filename.endsWith('.js.map')) return 'application/javascript'
  if (filename.endsWith('.css')) return 'text/css'
  if (filename.endsWith('.html')) return 'text/html'
  if (filename.endsWith('.webm')) return 'video/webm'
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg'
  if (filename.endsWith('.svg')) return 'image/svg+xml'
  if (filename.endsWith('.ico')) return 'image/x-icon'
  return 'text/plain'
}

const app = new Elysia()
  // Проксирование POST запросов /services/ на localhost:3001 (убираем префикс /services/)
  .post('/services/*', async ({ request, path }) => {
    try {
      // Убираем префикс /services/ из пути
      const servicePath = path.replace('/services/', '/')
      const targetUrl = `http://localhost:3001${servicePath}`
      
      console.log(`Proxying POST: ${path} -> ${targetUrl}`)
      
      // Копируем заголовки из исходного запроса
      const headers = new Headers()
      for (const [key, value] of request.headers.entries()) {
        // Исключаем заголовки, которые могут конфликтовать
        if (!['host', 'connection', 'content-length'].includes(key.toLowerCase())) {
          headers.set(key, value)
        }
      }
      
      // Создаем POST запрос к целевому серверу
      const proxyRequest = new Request(targetUrl, {
        method: 'POST',
        headers,
        body: request.body,
      })
      
      // Отправляем запрос и возвращаем ответ
      const response = await fetch(proxyRequest)
      
      // Создаем новый ответ с правильными заголовками
      const proxyResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      })
      
      return proxyResponse
      
    } catch (error) {
      console.error('Proxy error:', error)
      return new Response('Proxy Error', { 
        status: 502,
        headers: { 'Content-Type': 'text/plain' }
      })
    }
  })
  // Остальная логика для статических файлов и SPA
  .get('*', ({ path }) => {
    // Убираем ведущие слеши
    const cleanPath = path.replace(/^\/+/, '') || 'index.html'
    const filePath = join('dist', cleanPath)
    
    console.log(`Request: ${path} -> File: ${filePath}`)
    
    // Если это статический файл (имеет расширение) - пытаемся его отдать
    if (cleanPath.includes('.')) {
      if (existsSync(filePath)) {
        const content = readFileSync(filePath)
        return new Response(content, {
          headers: { 'Content-Type': getMimeType(filePath) }
        })
      }
      // Если статический файл не найден - 404
      return new Response('Not Found', { status: 404 })
    }
    
    // Для всех остальных путей (роуты SPA) - возвращаем index.html
    const indexPath = join('dist', 'index.html')
    if (existsSync(indexPath)) {
      const content = readFileSync(indexPath)
      return new Response(content, {
        headers: { 'Content-Type': 'text/html' }
      })
    }

    // libs 
    const libsPath = join('dist', 'libs', cleanPath)
    if (existsSync(libsPath)) {
      const content = readFileSync(libsPath)
      return new Response(content, {
        headers: { 'Content-Type': getMimeType(libsPath) }
      })
    }
    
    return new Response('index.html not found', { status: 404 })
  })
  .listen(3000)

console.log('🚀 Server running on http://localhost:3000')
console.log('🔄 Proxying POST /services/* to http://localhost:3001 (removing /services/ prefix)')