import { Handler, ResponseError } from '../../rpc/shared.js'
import { defaultLogger } from '../../logger.js'

export const rpc: Handler = async (context, [param]) => {
  const { count, to, hrmp, ump, dmp, transactions } = param || {}
  const now = context.chain.head.number
  const diff = to ? to - now : count
  const finalCount = diff > 0 ? diff : 1

  let finalHash: string | undefined

  for (let i = 0; i < finalCount; i++) {
    const block = await context.chain
      .newBlock({
        transactions,
        horizontalMessages: hrmp,
        upwardMessages: ump,
        downwardMessages: dmp,
      })
      .catch((error) => {
        throw new ResponseError(1, error.toString())
      })
    defaultLogger.debug({ hash: block.hash }, 'dev_newBlock')
    finalHash = block.hash
  }

  return finalHash
}
