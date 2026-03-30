import env from '../config/env.js'
import pg from 'pg'

const { Client } = pg

/**
 * Migration script to update existing roles from global.dashboard to global.inicio
 * This ensures proper separation between "Inicio" (global dashboard) and "Dashboard" (DropScan dashboard)
 */
async function migratePermissions() {
  const client = new Client({
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
  })

  try {
    await client.connect()
    console.log(`🔗 Connected to "${env.DB_NAME}"`)

    // Get all roles
    const result = await client.query('SELECT id, nombre, permisos FROM roles WHERE activo = true')
    const roles = result.rows

    console.log(`📋 Found ${roles.length} active roles to migrate`)

    let updated = 0
    for (const role of roles) {
      const permisos = role.permisos

      // Check if migration is needed
      if (permisos?.global?.dashboard !== undefined) {
        console.log(`\n🔄 Migrating role: ${role.nombre}`)
        console.log(`   Old: global.dashboard = ${permisos.global.dashboard}`)

        // Rename global.dashboard to global.inicio
        permisos.global.inicio = permisos.global.dashboard
        delete permisos.global.dashboard

        console.log(`   New: global.inicio = ${permisos.global.inicio}`)

        // Update in database
        await client.query(
          'UPDATE roles SET permisos = $1 WHERE id = $2',
          [JSON.stringify(permisos), role.id]
        )

        updated++
        console.log(`   ✅ Updated`)
      } else if (permisos?.global?.inicio !== undefined) {
        console.log(`\n✓ Role "${role.nombre}" already migrated (has global.inicio)`)
      } else {
        console.log(`\n⚠️  Role "${role.nombre}" has no global permissions`)
      }
    }

    console.log(`\n🎉 Migration complete: ${updated} role(s) updated`)
    await client.end()
    process.exit(0)
  } catch (error) {
    console.error('❌ Error migrating permissions:', error.message)
    process.exit(1)
  }
}

migratePermissions()
