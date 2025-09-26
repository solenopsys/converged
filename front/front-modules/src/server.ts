import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { readdirSync, existsSync } from 'fs'
import { join } from 'path'

const port = 3005;

// Конфигурация директорий модулей
const MODULE_DIRECTORIES = [
  './packages',
  '../../../private/front-modules/packages'  // Вторая директория модулей
]

// Общая функция конфигурации CORS
const corsConfig = {
  origin: true,
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
  }
}

// Функция для сканирования директорий и создания карты модулей
const scanModuleDirectories = () => {
  const moduleMap = new Map()
  
  MODULE_DIRECTORIES.forEach(baseDir => {
    if (!existsSync(baseDir)) {
      console.warn(`⚠️ Directory ${baseDir} does not exist, skipping...`)
      return
    }
    
    try {
      const dirs = readdirSync(baseDir)
      dirs.forEach(dir => {
        const fullPath = join(baseDir, dir)
        
        // Проверяем, что это директория
        try {
          const stats = require('fs').statSync(fullPath)
          if (stats.isDirectory()) {
            if (moduleMap.has(dir)) {
              console.warn(`⚠️ Module '${dir}' found in multiple directories. Using: ${moduleMap.get(dir)}`)
            } else {
              moduleMap.set(dir, baseDir)
            }
          }
        } catch (error) {
          console.warn(`⚠️ Error checking ${fullPath}:`, error.message)
        }
      })
    } catch (error) {
      console.error(`❌ Error scanning directory ${baseDir}:`, error.message)
    }
  })
  
  return moduleMap
}

// Функция для получения пути к модулю
const getModulePath = (moduleName, moduleMap) => {
  const baseName = moduleName.split('.')[0]
  const baseDirectory = moduleMap.get(baseName)
  
  if (!baseDirectory) {
    return null
  }
  
  return {
    baseName,
    baseDirectory,
    modulePath: join(baseDirectory, baseName, 'dist', moduleName),
    buildPath: join(baseDirectory, baseName)
  }
}

// Функция для получения пути к локализации
const getLocalePath = (moduleName, locale, moduleMap) => {
  const baseName = moduleName.split('.')[0]
  const baseDirectory = moduleMap.get(baseName)
  
  if (!baseDirectory) {
    return null
  }
  
  return {
    baseName,
    baseDirectory,
    localePath: join(baseDirectory, baseName, 'locales', locale),
    buildPath: join(baseDirectory, baseName)
  }
}

// Функция для получения списка всех модулей
const getAllModules = (moduleMap) => {
  const modules = {}
  
  MODULE_DIRECTORIES.forEach(baseDir => {
    modules[baseDir] = []
  })
  
  for (const [moduleName, directory] of moduleMap.entries()) {
    modules[directory].push(moduleName)
  }
  
  return modules
}

// Инициализация карты модулей при запуске
let moduleMap = scanModuleDirectories()
console.log(`📦 Found modules:`, Object.fromEntries(moduleMap))

const app = new Elysia()
  .use(cors(corsConfig))
  
  // Главная страница - получить список пакетов с группировкой по директориям
  .get('/', () => {
    try {
      // Пересканируем директории для актуальной информации
      moduleMap = scanModuleDirectories()
      const allModules = getAllModules(moduleMap)
      
      return { 
        success: true, 
        directories: MODULE_DIRECTORIES,
        modules: allModules,
        totalModules: moduleMap.size
      }
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to read module directories',
        details: error.message 
      }
    }
  })
  
  // Обновить карту модулей
  .post('/refresh', () => {
    try {
      moduleMap = scanModuleDirectories()
      const allModules = getAllModules(moduleMap)
      
      return {
        success: true,
        message: 'Module map refreshed',
        modules: allModules,
        totalModules: moduleMap.size
      }
    } catch (error) {
      return {
        success: false,
        error: 'Failed to refresh module map',
        details: error.message
      }
    }
  })
  
  // Получить модуль по имени
  .get('/modules/:name', async ({ params, set }) => {
    try {
      const { name } = params
      const moduleInfo = getModulePath(name, moduleMap)
      
      if (!moduleInfo) {
        set.status = 404
        return { 
          error: 'Module not found in any directory',
          availableModules: Array.from(moduleMap.keys())
        }
      }
      
      const { modulePath, buildPath } = moduleInfo

      const fileExists = await Bun.file(modulePath).exists()

      if (fileExists) {
        return Bun.file(modulePath)
      }

      // Сборка модуля если файл не найден
      console.log(`🔨 Building module ${name} in ${buildPath}`)
      await Bun.spawn(['bun', 'bld'], {
        cwd: buildPath
      }).exited

      const fileExistsAfterBuild = await Bun.file(modulePath).exists()
      
      if (fileExistsAfterBuild) {
        return Bun.file(modulePath)
      } else {
        set.status = 404
        return { 
          error: 'Module not found after build',
          modulePath,
          buildPath
        }
      }
    } catch (error) {
      set.status = 500
      return { 
        error: 'Failed to process module request',
        details: error.message
      }
    }
  })

  // Получить локализацию модуля
  .get('/modules/locale/:name/:locale', async ({ params, set }) => {
    try {
      const { name, locale } = params
      const localeInfo = getLocalePath(name, locale, moduleMap)
      
      if (!localeInfo) {
        set.status = 404
        return { 
          error: 'Module not found in any directory',
          availableModules: Array.from(moduleMap.keys())
        }
      }
      
      const { localePath, buildPath } = localeInfo

      const fileExists = await Bun.file(localePath).exists()

      if (fileExists) {
        return Bun.file(localePath)
      }

      // Сборка модуля если файл не найден
      console.log(`🔨 Building module ${name} in ${buildPath} for locale ${locale}`)
      await Bun.spawn(['bun', 'bld'], {
        cwd: buildPath
      }).exited

      const fileExistsAfterBuild = await Bun.file(localePath).exists()
      
      if (fileExistsAfterBuild) {
        return Bun.file(localePath)
      } else {
        set.status = 404
        return { 
          error: 'Locale file not found after build',
          localePath,
          buildPath
        }
      }
    } catch (error) {
      set.status = 500
      return { 
        error: 'Failed to process locale request',
        details: error.message
      }
    }
  })
  
  // Получить информацию о конкретном модуле
  .get('/modules/info/:name', ({ params, set }) => {
    try {
      const { name } = params
      const baseName = name.split('.')[0]
      const baseDirectory = moduleMap.get(baseName)
      
      if (!baseDirectory) {
        set.status = 404
        return {
          error: 'Module not found',
          availableModules: Array.from(moduleMap.keys())
        }
      }
      
      return {
        success: true,
        module: baseName,
        directory: baseDirectory,
        fullPath: join(baseDirectory, baseName),
        distPath: join(baseDirectory, baseName, 'dist'),
        localesPath: join(baseDirectory, baseName, 'locales')
      }
    } catch (error) {
      set.status = 500
      return {
        error: 'Failed to get module info',
        details: error.message
      }
    }
  })
  
  // SSE endpoint для уведомлений
  .get('/events', ({ set }) => {
    setSSEHeaders(set)

    return new ReadableStream({
      start(controller) {
        controller.enqueue('data: Connected to server\n\n')
        
        const interval = setInterval(() => {
          const time = new Date().toLocaleTimeString()
          controller.enqueue(`data: Current time: ${time}\n\n`)
        }, 2000)
        
        return () => clearInterval(interval)
      }
    })
  })
  
  // API для триггера события
  .post('/trigger', ({ body, set }) => {
    try {
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
        error: 'Failed to trigger event',
        details: error.message
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
console.log('ℹ️ Module info: http://localhost:' + port + '/modules/info/:name')
console.log('🔄 Refresh modules: POST http://localhost:' + port + '/refresh')
console.log(`📂 Scanning directories: ${MODULE_DIRECTORIES.join(', ')}`)