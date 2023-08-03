import { ApplyExtrinsicResult } from '@polkadot/types/interfaces'
import { DataSource } from 'typeorm'
import { HexString } from '@polkadot/util/types'
import { RegisteredTypes } from '@polkadot/types/types'
import { blake2AsHex } from '@polkadot/util-crypto'
import { u8aConcat, u8aToHex } from '@polkadot/util'
import type { TransactionValidity } from '@polkadot/types/interfaces/txqueue'

import { Api } from '../api.js'
import { Block } from './block.js'
import { BuildBlockMode, BuildBlockParams, DownwardMessage, HorizontalMessage, TxPool } from './txpool.js'
import { HeadState } from './head-state.js'
import { InherentProvider } from './inherent/index.js'
import { OffchainWorker } from '../offchain.js'
import { StorageValue } from './storage-layer.js'
import { compactHex } from '../utils/index.js'
import { defaultLogger } from '../logger.js'
import { dryRunExtrinsic, dryRunInherents } from './block-builder.js'

const logger = defaultLogger.child({ name: 'blockchain' })

export interface Options {
  api: Api
  buildBlockMode?: BuildBlockMode
  inherentProvider: InherentProvider
  db?: DataSource
  header: { number: number; hash: HexString }
  mockSignatureHost?: boolean
  allowUnresolvedImports?: boolean
  runtimeLogLevel?: number
  registeredTypes: RegisteredTypes
  offchainWorker?: boolean
  maxMemoryBlockCount?: number
}

export class Blockchain {
  readonly uid: string = Math.random().toString(36).substring(2)
  readonly api: Api
  readonly db: DataSource | undefined
  readonly mockSignatureHost: boolean
  readonly allowUnresolvedImports: boolean
  readonly runtimeLogLevel: number
  readonly registeredTypes: RegisteredTypes

  readonly #txpool: TxPool
  readonly #inherentProvider: InherentProvider

  #head: Block
  readonly #blocksByNumber: Map<number, Block> = new Map()
  readonly #blocksByHash: Record<string, Block> = {}
  readonly #loadingBlocks: Record<string, Promise<void>> = {}

  readonly headState: HeadState

  readonly offchainWorker: OffchainWorker | undefined
  readonly #maxMemoryBlockCount: number

  constructor({
    api,
    buildBlockMode,
    inherentProvider,
    db,
    header,
    mockSignatureHost = false,
    allowUnresolvedImports = false,
    runtimeLogLevel = 0,
    registeredTypes = {},
    offchainWorker = false,
    maxMemoryBlockCount = 2000,
  }: Options) {
    this.api = api
    this.db = db
    this.mockSignatureHost = mockSignatureHost
    this.allowUnresolvedImports = allowUnresolvedImports
    this.runtimeLogLevel = runtimeLogLevel
    this.registeredTypes = registeredTypes

    this.#head = new Block(this, header.number, header.hash)
    this.#registerBlock(this.#head)

    this.#txpool = new TxPool(this, inherentProvider, buildBlockMode)
    this.#inherentProvider = inherentProvider

    this.headState = new HeadState(this.#head)

    if (offchainWorker) {
      this.offchainWorker = new OffchainWorker()
    }

    this.#maxMemoryBlockCount = maxMemoryBlockCount
  }

  #registerBlock(block: Block) {
    // if exceed max memory block count, delete the oldest block
    if (this.#blocksByNumber.size === this.#maxMemoryBlockCount) {
      const firstKey = this.#blocksByNumber.keys().next().value
      this.#blocksByNumber.delete(firstKey)
    }
    this.#blocksByNumber.set(block.number, block)
    this.#blocksByHash[block.hash] = block
  }

  get head(): Block {
    return this.#head
  }

  get txPool() {
    return this.#txpool
  }

  async getBlockAt(number?: number): Promise<Block | undefined> {
    if (number === undefined) {
      return this.head
    }
    if (number > this.#head.number) {
      return undefined
    }
    if (!this.#blocksByNumber.has(number)) {
      const hash = await this.api.getBlockHash(number)
      const block = new Block(this, number, hash)
      this.#registerBlock(block)
    }
    return this.#blocksByNumber.get(number)
  }

  async getBlock(hash?: HexString): Promise<Block | undefined> {
    await this.api.isReady
    if (hash == null) {
      hash = this.head.hash
    }
    if (!this.#blocksByHash[hash]) {
      const loadingBlock = this.#loadingBlocks[hash]
      if (loadingBlock) {
        await loadingBlock
      } else {
        const loadingBlock = (async () => {
          try {
            const header = await this.api.getHeader(hash)
            const block = new Block(this, Number(header.number), hash)
            this.#registerBlock(block)
          } catch (e) {
            logger.debug(`getBlock(${hash}) failed: ${e}`)
          }
        })()
        this.#loadingBlocks[hash] = loadingBlock
        await loadingBlock
        delete this.#loadingBlocks[hash]
      }
    }
    return this.#blocksByHash[hash]
  }

  blocksInMemory(): Block[] {
    return Array.from(this.#blocksByNumber.values())
  }

  unregisterBlock(block: Block): void {
    if (block.hash === this.head.hash) {
      throw new Error('Cannot unregister head block')
    }
    if (this.#blocksByNumber.get(block.number)?.hash === block.hash) {
      this.#blocksByNumber.delete(block.number)
    }
    delete this.#blocksByHash[block.hash]
  }

  async setHead(block: Block): Promise<void> {
    logger.debug(
      {
        number: block.number,
        hash: block.hash,
      },
      'setHead',
    )
    this.#head = block
    this.#registerBlock(block)
    await this.headState.setHead(block)

    if (this.offchainWorker) {
      await this.offchainWorker.run(block)
    }
  }

  async submitExtrinsic(extrinsic: HexString): Promise<HexString> {
    const validity = await this.validateExtrinsic(extrinsic)
    if (validity.isOk) {
      await this.#txpool.submitExtrinsic(extrinsic)
      return blake2AsHex(extrinsic, 256)
    }
    throw validity.asErr
  }

  async validateExtrinsic(
    extrinsic: HexString,
    source: '0x00' | '0x01' | '0x02' = '0x02' /** External */,
  ): Promise<TransactionValidity> {
    const args = u8aToHex(u8aConcat(source, extrinsic, this.head.hash))
    const res = await this.head.call('TaggedTransactionQueue_validate_transaction', [args])
    const registry = await this.head.registry
    return registry.createType<TransactionValidity>('TransactionValidity', res.result)
  }

  submitUpwardMessages(id: number, ump: HexString[]) {
    this.#txpool.submitUpwardMessages(id, ump)

    logger.debug({ id, ump }, 'submitUpwardMessages')
  }

  submitDownwardMessages(dmp: DownwardMessage[]) {
    this.#txpool.submitDownwardMessages(dmp)

    logger.debug({ dmp }, 'submitDownwardMessages')
  }

  submitHorizontalMessages(id: number, hrmp: HorizontalMessage[]) {
    this.#txpool.submitHorizontalMessages(id, hrmp)

    logger.debug({ id, hrmp }, 'submitHorizontalMessages')
  }

  async newBlock(params?: Partial<BuildBlockParams>): Promise<Block> {
    await this.#txpool.buildBlock(params)
    return this.#head
  }

  async newBlockWithParams(params: BuildBlockParams): Promise<Block> {
    await this.#txpool.buildBlockWithParams(params)
    return this.#head
  }

  async upcomingBlocks() {
    return this.#txpool.upcomingBlocks()
  }

  async dryRunExtrinsic(
    extrinsic: HexString | { call: HexString; address: string },
    at?: HexString,
  ): Promise<{ outcome: ApplyExtrinsicResult; storageDiff: [HexString, HexString | null][] }> {
    await this.api.isReady
    const head = at ? await this.getBlock(at) : this.head
    if (!head) {
      throw new Error(`Cannot find block ${at}`)
    }
    const registry = await head.registry
    const inherents = await this.#inherentProvider.createInherents(head, {
      transactions: [],
      downwardMessages: [],
      upwardMessages: [],
      horizontalMessages: {},
    })
    const { result, storageDiff } = await dryRunExtrinsic(head, inherents, extrinsic)
    const outcome = registry.createType<ApplyExtrinsicResult>('ApplyExtrinsicResult', result)
    return { outcome, storageDiff }
  }

  async dryRunHrmp(
    hrmp: Record<number, HorizontalMessage[]>,
    at?: HexString,
  ): Promise<[HexString, HexString | null][]> {
    await this.api.isReady
    const head = at ? await this.getBlock(at) : this.head
    if (!head) {
      throw new Error(`Cannot find block ${at}`)
    }
    const inherents = await this.#inherentProvider.createInherents(head, {
      transactions: [],
      downwardMessages: [],
      upwardMessages: [],
      horizontalMessages: hrmp,
    })
    return dryRunInherents(head, inherents)
  }
  async dryRunDmp(dmp: DownwardMessage[], at?: HexString): Promise<[HexString, HexString | null][]> {
    await this.api.isReady
    const head = at ? await this.getBlock(at) : this.head
    if (!head) {
      throw new Error(`Cannot find block ${at}`)
    }
    const inherents = await this.#inherentProvider.createInherents(head, {
      transactions: [],
      downwardMessages: dmp,
      upwardMessages: [],
      horizontalMessages: {},
    })
    return dryRunInherents(head, inherents)
  }
  async dryRunUmp(ump: Record<number, HexString[]>, at?: HexString): Promise<[HexString, HexString | null][]> {
    await this.api.isReady
    const head = at ? await this.getBlock(at) : this.head
    if (!head) {
      throw new Error(`Cannot find block ${at}`)
    }
    const meta = await head.meta

    const needsDispatch = meta.registry.createType('Vec<u32>', Object.keys(ump))

    const storageValues: [string, StorageValue | null][] = [
      [compactHex(meta.query.ump.needsDispatch()), needsDispatch.toHex()],
    ]

    for (const [paraId, messages] of Object.entries(ump)) {
      const upwardMessages = meta.registry.createType('Vec<Bytes>', messages)
      if (upwardMessages.length === 0) throw new Error('No upward meesage')

      const queueSize = meta.registry.createType('(u32, u32)', [
        upwardMessages.length,
        upwardMessages.map((x) => x.byteLength).reduce((s, i) => s + i, 0),
      ])

      storageValues.push([compactHex(meta.query.ump.relayDispatchQueues(paraId)), upwardMessages.toHex()])
      storageValues.push([compactHex(meta.query.ump.relayDispatchQueueSize(paraId)), queueSize.toHex()])
    }

    head.pushStorageLayer().setAll(storageValues)
    const inherents = await this.#inherentProvider.createInherents(head, {
      transactions: [],
      downwardMessages: [],
      upwardMessages: [],
      horizontalMessages: {},
    })
    return dryRunInherents(head, inherents)
  }

  async getInherents(): Promise<HexString[]> {
    await this.api.isReady
    const inherents = await this.#inherentProvider.createInherents(this.head, {
      transactions: [],
      downwardMessages: [],
      upwardMessages: [],
      horizontalMessages: {},
    })
    return inherents
  }
}
