import { Generated, Insertable, Selectable, Updateable } from 'kysely'

// Основные типы для процессов
export type ProcessStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled'
export type NodeState = 'queued' | 'running' | 'done' | 'failed' | 'skipped'
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

// Таблица процессов
export interface ProcessTable {
  id: string
  workflow_id: string | null
  status: ProcessStatus
  started_at: Generated<Date>
  updated_at: Generated<Date>
  created_at: Generated<Date>
  meta: string | null // JSON строка для дополнительных данных
}

// Таблица узлов процесса
export interface NodesTable {
  id: Generated<number>
  process_id: string
  node_id: string
  state: NodeState
  started_at: Date | null
  completed_at: Date | null
  error_message: string | null
  retry_count: Generated<number>
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

// Таблица workflow
export interface WorkflowTable {
  id: string
  name: string
  current_version: string
  description: string | null
  is_active: Generated<boolean>
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

// Таблица webhook
export interface WebhookTable {
  id: Generated<number>
  name: string
  workflow_id: string
  url: string
  method: HttpMethod
  is_active: Generated<boolean>
  options: string | null // JSON строка для дополнительных опций
  created_at: Generated<Date>
  updated_at: Generated<Date>
}



// Общий интерфейс базы данных
export interface Database {
  process: ProcessTable
  nodes: NodesTable
  workflow: WorkflowTable
  webhook: WebhookTable
}

// Типы для вставки, выборки и обновления
export type Process = Selectable<ProcessTable>
export type NewProcess = Insertable<ProcessTable>
export type ProcessUpdate = Updateable<ProcessTable>

export type Node = Selectable<NodesTable>
export type NewNode = Insertable<NodesTable>
export type NodeUpdate = Updateable<NodesTable>

export type Workflow = Selectable<WorkflowTable>
export type NewWorkflow = Insertable<WorkflowTable>
export type WorkflowUpdate = Updateable<WorkflowTable>

export type Webhook = Selectable<WebhookTable>
export type NewWebhook = Insertable<WebhookTable>
export type WebhookUpdate = Updateable<WebhookTable>

// Дополнительные типы для удобства
export interface ProcessWithNodes extends Process {
  nodes: Node[]
}

export interface WorkflowWithWebhooks extends Workflow {
  webhooks: Webhook[]
}

// Типы для метаданных (JSON поля)
export interface ProcessMeta {
  triggeredBy?: 'webhook' | 'manual' | 'schedule' | 'process'
  triggerData?: Record<string, any>
  userId?: string
  tags?: string[]
}

export interface WebhookOptions {
  headers?: Record<string, string>
  timeout?: number
  retries?: number
  authentication?: {
    type: 'bearer' | 'basic' | 'api_key'
    config: Record<string, string>
  }
}