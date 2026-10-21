import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const turnoId = searchParams.get('turno_id');
  const periodo = searchParams.get('periodo') || '7d';
  const mesParam = searchParams.get('mes');

  try {
    // 1. Detalle específico de un turno si se hace clic
    if (turnoId) {
      const itemsRes = await query(
        `SELECT 
           v.id AS venta_id,
           v.fecha,
           v.total AS total_venta,
           v.metodo_pago,
           p.nombre AS producto,
           p.codigo_barras,
           d.cantidad,
           d.precio_unitario,
           d.subtotal
         FROM detalle_ventas d
         JOIN ventas v ON d.venta_id = v.id
         JOIN productos p ON d.producto_id = p.id
         WHERE v.turno_id = $1 AND v.estado = 'completada'
         ORDER BY v.fecha DESC`,
        [turnoId]
      );
      return NextResponse.json(itemsRes.rows);
    }

    // 2. Filtro temporal para análisis
    let dateFilter = "v.fecha >= NOW() - INTERVAL '7 days'";
    if (periodo === 'hoy') {
      dateFilter = "v.fecha >= CURRENT_DATE";
    } else if (periodo === '30d') {
      dateFilter = "v.fecha >= NOW() - INTERVAL '30 days'";
    } else if (periodo === 'mes' && mesParam) {
      dateFilter = `TO_CHAR(v.fecha, 'YYYY-MM') = '${mesParam}'`;
    }

    // A) Curva de evolución de ventas en el tiempo
    const curvaRes = await query(`
      SELECT 
        TO_CHAR(v.fecha, 'YYYY-MM-DD') AS dia,
        COALESCE(SUM(v.total), 0) AS total_dia,
        COUNT(v.id) AS tickets_dia
      FROM ventas v
      WHERE v.estado = 'completada' AND ${dateFilter}
      GROUP BY dia
      ORDER BY dia ASC
    `);

    // B) Top productos que más salen
    const topProductosRes = await query(`
      SELECT 
        p.nombre,
        COALESCE(SUM(d.cantidad), 0) AS total_unidades,
        COALESCE(SUM(d.subtotal), 0) AS total_facturado
      FROM detalle_ventas d
      JOIN ventas v ON d.venta_id = v.id
      JOIN productos p ON d.producto_id = p.id
      WHERE v.estado = 'completada' AND ${dateFilter}
      GROUP BY p.nombre
      ORDER BY total_unidades DESC
      LIMIT 6
    `);

    // C) Listado de turnos con LEFT JOIN (recupera todos los turnos guardados)
    const turnosRes = await query(`
      SELECT 
        t.id,
        t.fecha_apertura,
        t.fecha_cierre,
        t.monto_inicial,
        t.monto_esperado,
        t.monto_final_declarado,
        (COALESCE(t.monto_final_declarado, 0) - COALESCE(t.monto_esperado, 0)) AS diferencia_arqueo,
        t.estado,
        COALESCE(u.nombre, 'Cajero') AS cajero,
        COALESCE(u.rol::text, 'cajero') AS rol,
        COALESCE(SUM(v.total), 0) AS total_ventas,
        COUNT(v.id) AS cantidad_ventas
      FROM turnos_caja t
      LEFT JOIN usuarios u ON t.usuario_id = u.id
      LEFT JOIN ventas v ON v.turno_id = t.id AND v.estado = 'completada'
      GROUP BY t.id, u.nombre, u.rol
      ORDER BY t.id DESC
      LIMIT 50
    `);

    // D) Listado de últimas ventas individuales
    const ventasRes = await query(`
      SELECT 
        v.id,
        v.fecha,
        v.total,
        v.metodo_pago,
        v.turno_id,
        COALESCE(u.nombre, 'Cajero') AS cajero
      FROM ventas v
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      WHERE v.estado = 'completada'
      ORDER BY v.fecha DESC
      LIMIT 50
    `);

    return NextResponse.json({
      turnos: turnosRes.rows,
      ventas: ventasRes.rows,
      curva: curvaRes.rows,
      topProductos: topProductosRes.rows,
    });
  } catch (error: any) {
    console.error('Error en reportes:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}