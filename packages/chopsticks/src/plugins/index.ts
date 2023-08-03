import { lstatSync, readdirSync } from 'fs'
import { camelCase } from 'lodash-es'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { defaultLogger } from '../logger.js'
import { Handlers } from '../rpc/shared.js'
import yargs from 'yargs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const logger = defaultLogger.child({ name: 'plugin' })

export const pluginHandlers: Handlers = {}

const plugins = readdirSync(__dirname).filter((file) => lstatSync(`${__dirname}/${file}`).isDirectory())

;(async () => {
  for (const plugin of plugins) {
    const { rpc, name } = await import(`./${plugin}/index.js`)
    if (rpc) {
      const methodName = name || camelCase(plugin)
      pluginHandlers[`dev_${methodName}`] = rpc
      logger.debug(`Registered plugin ${plugin} RPC`)
    }
  }
})()

export const pluginExtendCli = async (y: yargs.Argv) => {
  for (const plugin of plugins) {
    const { cli } = await import(`./${plugin}/index.js`)
    if (cli) {
      cli(y)
      logger.debug(`Registered plugin ${plugin} CLI`)
    }
  }
}
