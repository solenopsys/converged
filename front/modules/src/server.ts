import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { readdirSync } from 'fs'

const port = 3005;

const app = new Elysia()
  // Добавляем CORS middleware
  .use(cors({
    origin: true, // Разрешает все origins, можно указать конкретные домены
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }))
  
  // Главная страница
  .get('/', () => {
    const listDirs = readdirSync('./packages')
    return listDirs
  })
  
  .get('/modules/:name', async ({ params }) => {
    const { name } = params
    const baseName = name.split('.')[0]
    const path = `./packages/${baseName}/dist/${name}`

    const fileExists = await Bun.file(path).exists()

    if (fileExists) {
      return Bun.file(path)
    }

    await Bun.spawn(['bun', 'bld'], {
      cwd: `./packages/${baseName}`
    }).exited

    return Bun.file(path)
  })

  .get('/modules/locale/:name/:locale', async ({ params }) => {
    const { name } = params
    const baseName = name.split('.')[0]
    const path = `./packages/${baseName}/locales/${params.locale}`

    const fileExists = await Bun.file(path).exists()

    if (fileExists) {
      return Bun.file(path)
    }

    await Bun.spawn(['bun', 'bld'], {
      cwd: `./packages/${baseName}`
    }).exited

    return Bun.file(path)
  })
  
  // SSE endpoint для уведомлений
  .get('/events', ({ set }) => {
    set.headers = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }

    return new ReadableStream({
      start(controller) {
        // Приветственное сообщение
        controller.enqueue('data: Connected to server\n\n')
        
        // Отправляем время каждые 2 секунды
        const interval = setInterval(() => {
          const time = new Date().toLocaleTimeString()
          controller.enqueue(`data: Current time: ${time}\n\n`)
        }, 2000)
        
        // Очистка при закрытии соединения
        return () => clearInterval(interval)
      }
    })
  })
  
  // API для триггера события
  .post('/trigger', ({ body }) => {
    // Здесь можно отправить событие всем подключенным клиентам
    // (для этого нужно хранить список контроллеров)
    return { message: 'Event triggered', data: body }
  })
  
  .listen(port)

console.log('🦊 Elysia server running at http://localhost:' + port)
console.log('📡 SSE endpoint: http://localhost:' + port + '/events')