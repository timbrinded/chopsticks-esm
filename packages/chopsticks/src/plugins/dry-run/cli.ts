import { Config } from '../../index.js'
import { defaultOptions } from '../../cli-options.js'
import { dryRunExtrinsic } from './dry-run-extrinsic.js'
import { dryRunPreimage } from './dry-run-preimage.js'
import type yargs from 'yargs'

export const cli = (y: yargs.Argv) => {
  y.command(
    'dry-run',
    'Dry run an extrinsic',
    (yargs) =>
      yargs.options({
        ...defaultOptions,
        extrinsic: {
          desc: 'Extrinsic or call to dry run. If you pass call here then address is required to fake signature',
          string: true,
        },
        address: {
          desc: 'Address to fake sign extrinsic',
          string: true,
        },
        preimage: {
          desc: 'Preimage to dry run',
          string: true,
        },
        at: {
          desc: 'Block hash to dry run',
          string: true,
        },
        'output-path': {
          desc: 'File path to print output',
          string: true,
        },
        html: {
          desc: 'Generate html with storage diff',
        },
        open: {
          desc: 'Open generated html',
        },
      }),
    async (argv) => {
      if (argv.preimage) {
        await dryRunPreimage(argv as Config)
      } else {
        await dryRunExtrinsic(argv as Config)
      }
    },
  )
}
