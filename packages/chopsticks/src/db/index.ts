import 'reflect-metadata'
import { DataSource } from 'typeorm'
import * as entities from './entities.js'
import { createRequire } from 'module';
const Require = createRequire(import.meta.url);

export const openDb = async (dbPath: string): Promise<DataSource> => {
  const source = new DataSource({
    type: 'better-sqlite3',
    database: dbPath,
    driver: Require('better-sqlite3'),
    entities: Object.values(entities),
    synchronize: true,
    logging: false,
  })

  await source.initialize()

  return source
}
