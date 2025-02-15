let ws = null;

// Функция для установки соединения
function connectWebSocket() {
    ws = new WebSocket('ws://localhost:3000/swws');
    
    ws.onopen = () => {
        console.log('WebSocket соединение установлено в Service Worker');
    };
    
    ws.onmessage = (event) => {
        console.log('Получено сообщение в SW:', event.data);
        // Можно переслать сообщение всем клиентам
        clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'WS_MESSAGE',
                    data: event.data
                });
            });
        });
    };
    
    ws.onclose = () => {
        console.log('WebSocket соединение закрыто');
        // Переподключение через 5 секунд
        setTimeout(connectWebSocket, 5000);
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket ошибка:', error);
    };
}

self.addEventListener('install', event => {
    console.log('Service Worker установлен.');
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('Service Worker активирован.');
    event.waitUntil(clients.claim());
    // Устанавливаем WebSocket соединение при активации
    connectWebSocket();
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    if (url.pathname.startsWith('@') || url.pathname.startsWith('/@')) {
        console.log('Перехвачен запрос к модулю:', url.pathname);
        
        // Можем отправить сообщение через WebSocket
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'MODULE_REQUEST',
                path: url.pathname
            }));
        }
        
        event.respondWith(
            new Response(
                `console.log("Модуль ${url.pathname} перехвачен");`,
                {
                    headers: {
                        'Content-Type': 'application/javascript',
                    }
                }
            )
        );
    }
});

// Обработка сообщений от клиентов
self.addEventListener('message', event => {
    if (event.data.type === 'WS_SEND' && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event.data.payload));
    }
});