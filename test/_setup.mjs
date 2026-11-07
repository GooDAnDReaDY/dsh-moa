import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-test-home-'))
const tempDsh = path.join(tempHome, '.dsh')
fs.mkdirSync(tempDsh, { recursive: true })
fs.mkdirSync(path.join(tempDsh, 'storages'), { recursive: true })

process.env.DSH_HOME = tempHome
process.env.DSH_HISTORY_DIR = tempDsh
process.env.DSH_HISTORY_FILE = path.join(tempDsh, 'moa-history.jsonl')
process.env.DSH_STORAGE_DIR = path.join(tempDsh, 'storages')
process.env.DSH_CATALOG_FILE = path.join(tempDsh, 'storages', 'dsh-moa-catalog.json')
process.env.NODE_ENV = 'test'
process.env.DSH_TEST = '1'
