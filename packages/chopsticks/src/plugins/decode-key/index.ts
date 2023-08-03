import { Config } from '../../index.js'
import { HexString } from '@polkadot/util/types'
import { decodeKey } from '../../utils/decoder.js'
import { defaultOptions } from '../../cli-options.js'
import { setup } from '../../setup.js'
import type yargs from 'yargs'

export const cli = (y: yargs.Argv) => {
  y.command(
    'decode-key <key>',
    'Deocde a key',
    (yargs) =>
      yargs
        .positional('key', {
          desc: 'Key to decode',
          type: 'string',
        })
        .options({
          ...defaultOptions,
        }),
    async (argv) => {
      const context = await setup(argv as Config)
      const { storage, decodedKey } = decodeKey(
        await context.chain.head.meta,
        context.chain.head,
        argv.key as HexString,
      )
      if (storage && decodedKey) {
        console.log(
          `${storage.section}.${storage.method}`,
          decodedKey.args.map((x) => JSON.stringify(x.toHuman())).join(', '),
        )
      } else {
        console.log('Unknown')
      }
      process.exit(0)
    },
  )
}
