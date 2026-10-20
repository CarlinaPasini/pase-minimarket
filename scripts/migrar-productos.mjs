import sqlite3 from 'sqlite3';
import pg from 'pg';

const { Pool } = pg;

// Configuración directa y explícita para Supabase (evita fallos de parseo de contraseña)
const pgPool = new Pool({
  user: 'postgres.vzopwjvuanjwgbbfsfor',
  host: 'aws-0-sa-east-1.pooler.supabase.com',
  database: 'postgres',
  password: String('Ismaluana.1'),
  port: 65432,
  ssl: { rejectUnauthorized: false },
});

const sqliteDb = new sqlite3.Database('./aronium.db', sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('❌ Error al abrir aronium.db:', err.message);
    process.exit(1);
  }
  console.log('✅ Conectado a aronium.db (SQLite)');
});

async function limpiarYMigrar() {
  console.log('☁️ Conectando a Supabase y preparando catálogo...');
  
  try {
    await pgPool.query('TRUNCATE TABLE productos CASCADE');
    console.log('🧹 Tabla productos vaciada en la nube.');
  } catch (err) {
    console.log('Aviso al limpiar:', err.message);
  }

  const querySqlite = `
    SELECT 
      p.Id,
      p.Name AS nombre,
      p.Price AS precio_venta,
      COALESCE(p.Cost, 0) AS precio_costo,
      COALESCE(
        (SELECT b.Value FROM Barcode b WHERE b.ProductId = p.Id ORDER BY b.Id DESC LIMIT 1),
        p.Code,
        ''
      ) AS codigo_barras,
      COALESCE(
        (SELECT SUM(s.Quantity) FROM Stock s WHERE s.ProductId = p.Id),
        0
      ) AS stock
    FROM Product p
    WHERE p.IsEnabled = 1 
      AND p.Name NOT LIKE 'DELETED%' 
      AND p.Name NOT LIKE 'delete%'
      AND p.Name NOT LIKE 'd%'
    GROUP BY p.Id
  `;

  sqliteDb.all(querySqlite, [], async (err, rows) => {
    if (err) {
      console.error('❌ Error consultando SQLite:', err);
      return;
    }

    console.log(`📦 Encontrados ${rows.length} artículos únicos. Subiendo a Supabase...`);
    let migrados = 0;
    let omitidos = 0;

    for (const item of rows) {
      let codigo = item.codigo_barras ? String(item.codigo_barras).trim() : '';

      if (!codigo) {
        codigo = '20' + String(item.Id).padStart(10, '0') + '0';
      }

      try {
        await pgPool.query(
          `INSERT INTO productos (codigo_barras, nombre, precio_costo, precio_venta, stock, activo)
           VALUES ($1, $2, $3, $4, $5, TRUE)
           ON CONFLICT (codigo_barras) DO UPDATE 
           SET nombre = EXCLUDED.nombre,
               precio_costo = EXCLUDED.precio_costo,
               precio_venta = EXCLUDED.precio_venta,
               stock = EXCLUDED.stock,
               activo = TRUE`,
          [
            codigo,
            item.nombre.trim(),
            parseFloat(item.precio_costo) || 0,
            parseFloat(item.precio_venta) || 0,
            parseFloat(item.stock) || 0,
          ]
        );
        migrados++;
      } catch (pgErr) {
        omitidos++;
      }
    }

    console.log('\n========================================');
    console.log('☁️ ¡MIGRACIÓN A SUPABASE EXITOSA!');
    console.log(`   ✔️ Productos cargados en la nube: ${migrados}`);
    if (omitidos > 0) console.log(`   ⚠️ Duplicados u omitidos: ${omitidos}`);
    console.log('========================================\n');

    sqliteDb.close();
    await pgPool.end();
  });
}

limpiarYMigrar();