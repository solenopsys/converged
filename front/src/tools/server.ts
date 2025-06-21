import { Elysia } from 'elysia'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const getMimeType = (filename) => {
  if (filename.endsWith('.js')) return 'application/javascript'
  if (filename.endsWith('.js.map')) return 'application/javascript'
  if (filename.endsWith('.css')) return 'text/css'
  if (filename.endsWith('.html')) return 'text/html'
  if (filename.endsWith('.html')) return 'text/html'
  if (filename.endsWith('.webm')) return 'video/webm'
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg'
  if (filename.endsWith('.svg')) return 'image/svg+xml'
  if (filename.endsWith('.ico')) return 'image/x-icon'
  return 'text/plain'
}

const app = new Elysia()
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
    
    return new Response('index.html not found', { status: 404 })
  })
  .listen(3000)

console.log('🚀 Server running on http://localhost:3000')