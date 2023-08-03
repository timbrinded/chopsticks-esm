import { Block } from '../blockchain/block.js'
import { HexString } from '@polkadot/util/types'
import { decodeStorageDiff } from './decoder.js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { template } from 'lodash-es'
import path from 'node:path'

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const generateHtmlDiff = async (block: Block, diff: [HexString, HexString | null][]) => {
  const [left, _right, delta] = await decodeStorageDiff(block, diff)
  const htmlTemplate = readFileSync(path.join(__dirname, '../../template/diff.html'), 'utf-8')
  return template(htmlTemplate)({ left: JSON.stringify(left), delta: JSON.stringify(delta) })
}

export const generateHtmlDiffPreviewFile = async (
  block: Block,
  diff: [HexString, HexString | null][],
  filename: string,
) => {
  const html = await generateHtmlDiff(block, diff)
  mkdirSync('./preview', { recursive: true })
  const filePath = `./preview/${filename}.html`
  writeFileSync(filePath, html)
  return filePath
}
