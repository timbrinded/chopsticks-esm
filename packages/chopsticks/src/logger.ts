// import {createRequire} from "module"
// const Require = createRequire(import.meta.url)
// const createLogger = Require('pino')
import { default as Pino } from 'pino';

export const defaultLogger = Pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
  },
})

const innerTruncate =
  (level = 0) =>
  (val: any) => {
    const verboseLog = !!process.env.VERBOSE_LOG
    const levelLimit = verboseLog ? 10 : 5
    if (val == null) {
      return val
    }
    if (level > levelLimit) {
      return '( Too Deep )'
    }
    switch (typeof val) {
      case 'string':
        if (val.length > 66 && !verboseLog) {
          return val.slice(0, 34) + '…' + val.slice(-32)
        } else {
          return val
        }
      case 'object':
        if (Array.isArray(val)) {
          return val.map(innerTruncate(level + 1))
        }
        return Object.fromEntries(
          Object.entries(val.toJSON ? val.toJSON() : val).map(([k, v]) => [k, innerTruncate(level + 1)(v)]),
        )
      default:
        return val
    }
  }

export const truncate = (val: any) => innerTruncate(0)(val)
