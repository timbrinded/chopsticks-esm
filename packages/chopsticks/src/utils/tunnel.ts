import { bootstrap } from 'global-agent-ts'

globalThis.GLOBAL_AGENT = {};

globalThis.GLOBAL_AGENT.HTTP_PROXY =
  process.env.HTTP_PROXY ||
  process.env.http_proxy ||
  process.env.HTTPS_PROXY ||
  process.env.https_proxy ||
  'http://127.0.0.1:8000'

bootstrap()
