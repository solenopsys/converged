import { Elysia } from 'elysia'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const getMimeType = (filename) => {
  if (filename.endsWith('.js')) return 'application/javascript'
  if (filename.endsWith('.css')) return 'text/css'
  if (filename.endsWith('.html')) return 'text/html'
  if (filename.endsWith('.png')) return 'image/png'
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg'
  if (filename.endsWith('.svg')) return 'image/svg+xml'
  return 'text/plain'
}

const app = new Elysia()
  .get('*', ({ path }) => {
    const filePath = join('dist', path === '/' ? 'index.html' : path)
    
    if (existsSync(filePath)) {
      const content = readFileSync(filePath)
      return new Response(content, {
        headers: { 'Content-Type': getMimeType(filePath) }
      })
    }
    
    // SPA fallback - возвращаем index.html для роутов
    if (!path.includes('.')) {
      const indexPath = join('dist', 'index.html')
      if (existsSync(indexPath)) {
        const content = readFileSync(indexPath)
        return new Response(content, {
          headers: { 'Content-Type': 'text/html' }
        })
      }
    }
    
    return new Response('Not Found', { status: 404 })
  })
  .listen(3000)

console.log('🚀 Server running on http://localhost:3000')