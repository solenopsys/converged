import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { readdirSync } from 'fs'

const port = 3005;

// Общая функция конфигурации CORS
const corsConfig = {
  origin: true, // Разрешает все origins, можно указать конкретные домены
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
  credentials: true
}

// Функция для установки SSE заголовков с учетом CORS
const setSSEHeaders = (set) => {
  set.headers = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    // CORS заголовки уже обрабатываются middleware, поэтому удаляем их отсюда
  }
}

const app = new Elysia()
  // Добавляем CORS middleware глобально
  .use(cors(corsConfig))
  
  // Главная страница - получить список пакетов
  .get('/', () => {
    try {
      const listDirs = readdirSync('./packages')
      return { success: true, packages: listDirs }
    } catch (error) {
      return { success: false, error: 'Failed to read packages directory' }
    }
  })
  
  // Получить модуль по имени
  .get('/modules/:name', async ({ params, set }) => {
    try {
      const { name } = params
      const baseName = name.split('.')[0]
      const path = `./packages/${baseName}/dist/${name}`

      const fileExists = await Bun.file(path).exists()

      if (fileExists) {
        return Bun.file(path)
      }

      // Сборка модуля если файл не найден
      await Bun.spawn(['bun', 'bld'], {
        cwd: `./packages/${baseName}`
      }).exited

      const fileExistsAfterBuild = await Bun.file(path).exists()
      
      if (fileExistsAfterBuild) {
        return Bun.file(path)
      } else {
        set.status = 404
        return { error: 'Module not found after build' }
      }
    } catch (error) {
      set.status = 500
      return { error: 'Failed to process module request' }
    }
  })

  // Получить локализацию модуля
  .get('/modules/locale/:name/:locale', async ({ params, set }) => {
    try {
      const { name, locale } = params
      const baseName = name.split('.')[0]
      const path = `./packages/${baseName}/locales/${locale}`

      const fileExists = await Bun.file(path).exists()

      if (fileExists) {
        return Bun.file(path)
      }

      // Сборка модуля если файл не найден
      await Bun.spawn(['bun', 'bld'], {
        cwd: `./packages/${baseName}`
      }).exited

      const fileExistsAfterBuild = await Bun.file(path).exists()
      
      if (fileExistsAfterBuild) {
        return Bun.file(path)
      } else {
        set.status = 404
        return { error: 'Locale file not found after build' }
      }
    } catch (error) {
      set.status = 500
      return { error: 'Failed to process locale request' }
    }
  })
  
  // SSE endpoint для уведомлений
  .get('/events', ({ set }) => {
    setSSEHeaders(set)

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
  .post('/trigger', ({ body, set }) => {
    try {
      // Здесь можно отправить событие всем подключенным клиентам
      // (для этого нужно хранить список контроллеров)
      return { 
        success: true,
        message: 'Event triggered', 
        data: body,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      set.status = 500
      return { 
        success: false,
        error: 'Failed to trigger event' 
      }
    }
  })
  
  // Обработчик для несуществующих маршрутов
  .all('*', ({ set }) => {
    set.status = 404
    return { error: 'Route not found' }
  })
  
  .listen(port)

console.log('🦊 Elysia server running at http://localhost:' + port)
console.log('📡 SSE endpoint: http://localhost:' + port + '/events')
console.log('📦 Modules endpoint: http://localhost:' + port + '/modules/:name')
console.log('🌍 Locales endpoint: http://localhost:' + port + '/modules/locale/:name/:locale')