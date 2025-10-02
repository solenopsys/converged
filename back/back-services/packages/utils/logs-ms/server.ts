// Список сервисов
const services = [
  { name: "UserService", description: "Управление пользователями" },
  { name: "ProductService", description: "Каталог продуктов" },
  { name: "OrderService", description: "Обработка заказов" },
  { name: "PaymentService", description: "Платежная система" },
  { name: "NotificationService", description: "Уведомления" }
];

const server = Bun.serve({
  port: 3000,
  fetch(req, server) {
    // Апгрейд HTTP соединения до WebSocket
    if (server.upgrade(req)) {
      return;
    }
    return new Response("Ожидается WebSocket соединение", { status: 400 });
  },
  websocket: {
    open(ws) {
      console.log('Новое подключение установлено');
    },
    message(ws, message) {
      try {
        const request = JSON.parse(message);
        console.log('Получено сообщение:', request);

        let response;

        // Обработка разных типов запросов MCP
        switch (request.method) {
          case 'initialize':
            response = {
              jsonrpc: '2.0',
              id: request.id,
              result: {
                protocolVersion: '2024-11-05',
                capabilities: {
                  tools: {}
                },
                serverInfo: {
                  name: 'simple-service-list-server',
                  version: '1.0.0'
                }
              }
            };
            break;

          case 'tools/list':
            response = {
              jsonrpc: '2.0',
              id: request.id,
              result: {
                tools: [{
                  name: 'list_services',
                  description: 'Возвращает список всех доступных сервисов',
                  inputSchema: {
                    type: 'object',
                    properties: {},
                    required: []
                  }
                }]
              }
            };
            break;

          case 'tools/call':
            if (request.params.name === 'list_services') {
              response = {
                jsonrpc: '2.0',
                id: request.id,
                result: {
                  content: [{
                    type: 'text',
                    text: JSON.stringify(services, null, 2)
                  }]
                }
              };
            }
            break;

          default:
            response = {
              jsonrpc: '2.0',
              id: request.id,
              error: {
                code: -32601,
                message: 'Method not found'
              }
            };
        }

        // Отправляем ответ
        ws.send(JSON.stringify(response));

      } catch (error) {
        console.error('Ошибка обработки сообщения:', error);
        ws.send(JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32700,
            message: 'Parse error'
          }
        }));
      }
    },
    close(ws) {
      console.log('Соединение закрыто');
    },
    error(ws, error) {
      console.error('WebSocket ошибка:', error);
    }
  }
});

console.log(`MCP WebSocket сервер запущен на ws://localhost:${server.port}`);