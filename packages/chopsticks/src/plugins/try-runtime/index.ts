import { writeFileSync } from 'node:fs'
import type yargs from 'yargs'

import { Config } from '../../index.js'
import { defaultOptions } from '../../cli-options.js'
import { generateHtmlDiffPreviewFile } from '../../utils/generate-html-diff.js'
import { openHtml } from '../../utils/open-html.js'
import { setup } from '../../setup.js'

export const cli = (y: yargs.Argv) => {
  y.command(
    'try-runtime',
    'Runs runtime upgrade',
    (yargs) =>
      yargs.options({
        ...defaultOptions,
        'wasm-override': {
          desc: 'Path to WASM built with feature `try-runtime` enabled',
          string: true,
          required: true,
        },
        'output-path': {
          desc: 'File path to print output',
          string: true,
        },
        html: {
          desc: 'Generate html with storage diff',
          boolean: true,
        },
        open: {
          desc: 'Open generated html',
          boolean: true,
        },
      }),
    async (argv) => {
      const context = await setup(argv as Config)
      const block = context.chain.head
      const registry = await block.registry
      registry.register({
        UpgradeCheckSelect: {
          _enum: {
            None: null,
          },
        },
      })

      const select_none = registry.createType('UpgradeCheckSelect', 'None')
      const result = await block.call('TryRuntime_on_runtime_upgrade', [select_none.toHex()])

      if (argv.html) {
        const filePath = await generateHtmlDiffPreviewFile(block, result.storageDiff, block.hash)
        console.log(`Generated preview ${filePath}`)
        if (argv.open) {
          openHtml(filePath)
        }
      } else if (argv.outputPath) {
        writeFileSync(argv.outputPath, JSON.stringify(result, null, 2))
      } else {
        console.dir(result, { depth: null, colors: false })
      }

      process.exit(0)
    },
  )
}
