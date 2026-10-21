import sqlite3 from 'sqlite3';
import fs from 'fs';

const sqliteDb = new sqlite3.Database('./aronium.db', sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('❌ Error al abrir aronium.db:', err.message);
    process.exit(1);
  }
  console.log('✅ Conectado a aronium.db (SQLite)');
});

const querySqlite = `
  SELECT 
    p.Id,
    p.Name AS nombre,
    p.Price AS precio_venta,
    COALESCE(p.Cost, 0) AS precio_costo,
    COALESCE(
      (SELECT GROUP_CONCAT(DISTINCT b.Value) FROM Barcode b WHERE b.ProductId = p.Id),
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

sqliteDb.all(querySqlite, [], (err, rows) => {
  if (err) {
    console.error('❌ Error leyendo SQLite:', err);
    return;
  }

  console.log(`📦 Procesando ${rows.length} productos...`);

  const sqlStatements = [];
  sqlStatements.push('-- Actualización masiva de códigos concatenados por coma');

  for (const item of rows) {
    let codigos = [];
    if (item.codigo_barras) {
      codigos = String(item.codigo_barras)
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
    }
    if (codigos.length === 0) {
      codigos.push('20' + String(item.Id).padStart(10, '0') + '0');
    }

    const codigosFinal = Array.from(new Set(codigos)).join(', ').replace(/'/g, "''");
    const nombreLimpio = item.nombre.trim().replace(/'/g, "''");

    sqlStatements.push(
      `UPDATE productos SET codigo_barras = '${codigosFinal}' WHERE LOWER(TRIM(nombre)) = LOWER(TRIM('${nombreLimpio}'));`
    );
  }

  fs.writeFileSync('./actualizar_codigos.sql', sqlStatements.join('\n'), 'utf-8');

  console.log('\n========================================');
  console.log('✅ ¡ARCHIVO actualizar_codigos.sql GENERADO CON ÉXITO!');
  console.log('========================================\n');

  sqliteDb.close();
});