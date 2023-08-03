import { BuildBlockMode } from '../../blockchain/txpool.js'
import { Handler, ResponseError } from '../../rpc/shared.js'
import { defaultLogger } from '../../logger.js'

export const rpc: Handler = async (context, [mode]) => {
  defaultLogger.debug({ mode }, 'dev_setBlockBuildMode')

  if (BuildBlockMode[mode] === undefined) {
    throw new ResponseError(1, `Invalid mode ${mode}`)
  }

  context.chain.txPool.mode = mode
}
