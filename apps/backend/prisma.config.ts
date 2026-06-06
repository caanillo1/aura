import { defineConfig } from 'prisma/config'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '.env') })

const {
  DB_HOST = 'localhost',
  DB_PORT = '1433',
  DB_NAME = 'AuraERP',
  DB_USER = 'sa',
  DB_PASSWORD = '',
} = process.env

// Escapar caracteres especiales en la contraseña
const escapedPassword = encodeURIComponent(DB_PASSWORD)

const url =
  `sqlserver://${DB_HOST}:${DB_PORT};` +
  `database=${DB_NAME};` +
  `user=${DB_USER};` +
  `password=${escapedPassword};` +
  `encrypt=false;` +
  `trustServerCertificate=true;` +
  `loginTimeout=30;` +
  `connectionTimeout=30`

export default defineConfig({
  datasourceUrl: url,
})
