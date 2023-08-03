import { Blockchain } from '../blockchain/index.js'
import { defaultLogger } from '../logger.js'

export const logger = defaultLogger.child({ name: 'rpc' })

export class ResponseError extends Error {
  code: number

  constructor(code: number, message: string) {
    super(message)
    this.name = 'ResponseError'
    this.code = code
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
    }
  }
}

export interface Context {
  chain: Blockchain
}

export interface SubscriptionManager {
  subscribe: (method: string, subid: string, onCancel?: () => void) => (data: any) => void
  unsubscribe: (subid: string) => void
}

export type Handler = (
  context: Context,
  params: any[],
  subscriptionManager: SubscriptionManager,
) => Promise<object | string | number | void | undefined | null>
export type Handlers = Record<string, Handler>
