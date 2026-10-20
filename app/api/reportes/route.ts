import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const turnoId = searchParams.get('turno_id');

  try {
    // Si se pide el detalle de un turno específico al hacer clic
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

    // Listado general de turnos con totales
    const turnosRes = await query(`
      SELECT 
        t.id,
        t.fecha_apertura,
        t.fecha_cierre,
        t.monto_inicial,
        t.monto_esperado,
        t.monto_final_declarado,
        (t.monto_final_declarado - t.monto_esperado) AS diferencia_arqueo,
        t.estado,
        u.nombre AS cajero,
        u.rol,
        COALESCE(SUM(v.total), 0) AS total_ventas,
        COUNT(v.id) AS cantidad_ventas
      FROM turnos_caja t
      JOIN usuarios u ON t.usuario_id = u.id
      LEFT JOIN ventas v ON v.turno_id = t.id AND v.estado = 'completada'
      GROUP BY t.id, u.nombre, u.rol
      ORDER BY t.id DESC
      LIMIT 40
    `);

    // Listado de tickets individuales
    const ventasRes = await query(`
      SELECT 
        v.id,
        v.fecha,
        v.total,
        v.metodo_pago,
        v.turno_id,
        u.nombre AS cajero
      FROM ventas v
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      WHERE v.estado = 'completada'
      ORDER BY v.fecha DESC
      LIMIT 50
    `);

    return NextResponse.json({
      turnos: turnosRes.rows,
      ventas: ventasRes.rows,
    });
  } catch (error: any) {
    console.error('Error al obtener reportes:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}