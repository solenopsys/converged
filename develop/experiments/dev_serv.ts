import { Elysia } from 'elysia'
import { staticPlugin } from "@elysiajs/static"
import { readFile } from 'fs/promises'

const app = new Elysia()
    .use(staticPlugin({
        assets: 'public',
        prefix: '/'
    }))
    
    // WebSocket endpoint для Service Worker
    .ws('/swws', {
        message: (ws, message) => {
            console.log('Получено сообщение от SW:', message)
            
            // Пример ответа на сообщение от SW
            if (typeof message === 'object' && message.type === 'MODULE_REQUEST') {
                ws.send(JSON.stringify({
                    type: 'MODULE_RESPONSE',
                    path: message.path,
                    content: `console.log("Модуль ${message.path} загружен с сервера");`
                }))
            }
        },
        open: (ws) => {
            console.log('Service Worker подключился к WebSocket')
        },
        close: (ws) => {
            console.log('Service Worker отключился от WebSocket')
        },
        error: (ws, error) => {
            console.error('WebSocket ошибка:', error)
        }
    })
    
    // Главная страница
    .get('/', async () => {
        return new Response(
            await readFile('./public/index.html'),
            {
                headers: {
                    'Content-Type': 'text/html'
                }
            }
        )
    })
    
    .onError(({ code, error, set }) => {
        if (code === 'NOT_FOUND') {
            set.status = 404
            return 'Page not found'
        }
    })
    
    .listen(3000, () => {
        console.log('🦊 Server is running on http://localhost:3000')
    })