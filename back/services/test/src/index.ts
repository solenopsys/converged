import { Elysia } from 'elysia'

export interface TestPluginOptions {
  prefix?: string
}

export const testPlugin = (opts: TestPluginOptions = {}) => (app: Elysia) => {
  const prefix = opts.prefix ?? '/test'
  
  console.log(`🔌 Test plugin starting with prefix: ${prefix}`)
  
  return app
    .group(prefix, (app) => 
      app
        .get('/hello', () => {
          console.log(`👋 Hello endpoint called at ${prefix}/hello`)
          return { message: 'Hello from test plugin!', prefix }
        })
        .get('/status', () => {
          console.log(`📊 Status endpoint called at ${prefix}/status`)
          return { 
            status: 'ok', 
            timestamp: new Date().toISOString(),
            prefix 
          }
        })
    )
    .onAfterHandle(() => {
      console.log(`🔄 Request handled by test plugin`)
    })
}

export default testPlugin