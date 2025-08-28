import { Elysia } from 'elysia'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const getMimeType = (filename) => {
  if (filename.endsWith('.js')) return 'application/javascript'
  if (filename.endsWith('.js.map')) return 'application/javascript'
  if (filename.endsWith('.css')) return 'text/css'
  if (filename.endsWith('.html')) return 'text/html'
  if (filename.endsWith('.webm')) return 'video/webm'
  if (filename.endsWith('.webp')) return 'image/webp'
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg'
  if (filename.endsWith('.png')) return 'image/png'
  if (filename.endsWith('.gif')) return 'image/gif'
  if (filename.endsWith('.svg')) return 'image/svg+xml'
  if (filename.endsWith('.ico')) return 'image/x-icon'
  if (filename.endsWith('.woff') || filename.endsWith('.woff2')) return 'font/woff2'
  if (filename.endsWith('.ttf')) return 'font/ttf'
  if (filename.endsWith('.json')) return 'application/json'
  return 'text/plain'
}

// Функция для проверки, является ли путь статическим ресурсом
const isStaticResource = (path) => {
  // Статические ресурсы обычно имеют расширения
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', 
                           '.ico', '.woff', '.woff2', '.ttf', '.json', '.webm', '.webp',
                           '.mp4', '.pdf', '.zip', '.js.map']
  
  return staticExtensions.some(ext => path.toLowerCase().endsWith(ext))
}

// Функция для поиска файла в различных директориях
const findStaticFile = (relativePath) => {
  const possiblePaths = [
    join('dist', relativePath),
    join('dist', 'assets', relativePath),
    join('dist', 'libs', relativePath),
    join('dist', 'static', relativePath),
    join('dist', 'public', relativePath)
  ]
  
  for (const filePath of possiblePaths) {
    if (existsSync(filePath)) {
      return filePath
    }
  }
  
  return null
}

const app = new Elysia()
 
  // Обработка всех GET запросов
  .get('*', ({ path, request }) => {
    // Убираем ведущие слеши и получаем чистый путь
    const cleanPath = path.replace(/^\/+/, '')
    
    console.log(`Request: ${path} -> Clean path: ${cleanPath}`)
    
    // Если путь пустой - отдаем index.html
    if (!cleanPath || cleanPath === '') {
      const indexPath = join('dist', 'index.html')
      if (existsSync(indexPath)) {
        const content = readFileSync(indexPath)
        return new Response(content, {
          headers: { 'Content-Type': 'text/html' }
        })
      }
      return new Response('index.html not found', { status: 404 })
    }
    
    // Проверяем, является ли это запросом статического ресурса
    if (isStaticResource(cleanPath)) {
      console.log(`Static resource detected: ${cleanPath}`)
      
      // Ищем файл в различных директориях
      const foundPath = findStaticFile(cleanPath)
      
      if (foundPath) {
        console.log(`Static file found: ${foundPath}`)
        const content = readFileSync(foundPath)
        return new Response(content, {
          headers: { 
            'Content-Type': getMimeType(foundPath),
            'Cache-Control': 'public, max-age=31536000' // Кэширование статических ресурсов
          }
        })
      }
      
      // Статический файл не найден
      console.log(`Static file not found: ${cleanPath}`)
      return new Response('Static file not found', { status: 404 })
    }
    
    // Для всех остальных путей (SPA роуты) - возвращаем index.html
    console.log(`SPA route detected: ${cleanPath}`)
    const indexPath = join('dist', 'index.html')
    if (existsSync(indexPath)) {
      const content = readFileSync(indexPath)
      return new Response(content, {
        headers: { 
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache' // Не кэшируем SPA роуты
        }
      })
    }
    
    return new Response('index.html not found', { status: 404 })
  })
  .listen(3000)

console.log('🚀 Server running on http://localhost:3000')
console.log('🔄 Proxying POST /services/* to http://localhost:3001 (removing /services/ prefix)')
console.log('📁 Serving SPA from dist/ directory with fallback to index.html')