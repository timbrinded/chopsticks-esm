import { HexString } from '@polkadot/util/types'
import { Handler, ResponseError } from '../../rpc/shared.js'
import { StorageValues, setStorage } from '../../utils/set-storage.js'
import { defaultLogger } from '../../logger.js'

export const rpc: Handler = async (context, params) => {
  const [values, blockHash] = params as [StorageValues, HexString?]
  const hash = await setStorage(context.chain, values, blockHash).catch((error) => {
    throw new ResponseError(1, error.toString())
  })
  defaultLogger.debug(
    {
      hash,
      values,
    },
    'dev_setStorage',
  )
  return hash
}
