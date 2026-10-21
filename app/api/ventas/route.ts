import { NextResponse } from 'next/server';
import pool from '../../../lib/db';

export async function POST(request: Request) {
  const client = await pool.connect();

  try {
    const body = await request.json();
    const { items, metodo_pago, monto_recibido, total, vuelto, pagos, turno_id, usuario_id } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No hay productos en la venta' }, { status: 400 });
    }

    await client.query('BEGIN');

    // 1. Insertar la cabecera de la venta vinculada al turno y usuario real
    const insertVentaText = `
      INSERT INTO ventas (total, metodo_pago, monto_recibido, vuelto, estado, turno_id, usuario_id)
      VALUES ($1, $2, $3, $4, 'completada', $5, $6)
      RETURNING id, fecha
    `;
    const resVenta = await client.query(insertVentaText, [
      total,
      metodo_pago || 'mixto',
      monto_recibido || total,
      vuelto || 0,
      turno_id || null,
      usuario_id || null,
    ]);
    const ventaId = resVenta.rows[0].id;

    // 2. Registrar desglose de medios de pago en pagos_ventas
    if (pagos && Array.isArray(pagos) && pagos.length > 0) {
      for (const p of pagos) {
        if (Number(p.monto) > 0) {
          await client.query(
            `INSERT INTO pagos_ventas (venta_id, metodo, monto) VALUES ($1, $2, $3)`,
            [ventaId, p.metodo, p.monto]
          );
        }
      }
    } else {
      await client.query(
        `INSERT INTO pagos_ventas (venta_id, metodo, monto) VALUES ($1, $2, $3)`,
        [ventaId, metodo_pago || 'efectivo', total]
      );
    }

    // 3. Registrar detalle de venta y descontar stock automáticamente
    for (const item of items) {
      const subtotal = item.precio * item.cantidad;

      await client.query(
        `INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [ventaId, item.id, item.cantidad, item.precio, subtotal]
      );

      await client.query(
        `UPDATE productos 
         SET stock = stock - $1 
         WHERE id = $2`,
        [item.cantidad, item.id]
      );
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      venta_id: ventaId,
      fecha: resVenta.rows[0].fecha,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error al registrar venta:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}