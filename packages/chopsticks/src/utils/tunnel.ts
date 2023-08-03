import npmConf from '@pnpm/npm-conf'
import { bootstrap } from 'global-agent'

const npmConfig = npmConf().config

process.env.GLOBAL_AGENT_HTTP_PROXY =
  process.env.HTTP_PROXY ||
  process.env.http_proxy ||
  process.env.HTTPS_PROXY ||
  process.env.https_proxy ||
  npmConfig.get('proxy') ||
  npmConfig.get('https-proxy')

bootstrap()
