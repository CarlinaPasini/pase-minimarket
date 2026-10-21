import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';

// 1. Obtener resumen de caja del turno actual
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const turnoId = searchParams.get('turno_id');

  if (!turnoId) {
    return NextResponse.json({ error: 'Falta turno_id' }, { status: 400 });
  }

  try {
    const turnoRes = await query('SELECT * FROM turnos_caja WHERE id = $1', [turnoId]);
    if (turnoRes.rows.length === 0) {
      return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
    }
    const turno = turnoRes.rows[0];

    // Resumen de ventas agrupadas
    const resumenRes = await query(
      `SELECT 
         COALESCE(SUM(total), 0) AS total_vendido,
         COALESCE(SUM(CASE WHEN metodo_pago = 'efectivo' THEN total ELSE 0 END), 0) AS total_efectivo,
         COALESCE(SUM(CASE WHEN metodo_pago = 'tarjeta' THEN total ELSE 0 END), 0) AS total_tarjeta,
         COALESCE(SUM(CASE WHEN metodo_pago = 'transferencia' THEN total ELSE 0 END), 0) AS total_transferencia,
         COUNT(id) AS cantidad_ventas
       FROM ventas 
       WHERE turno_id = $1 AND estado = 'completada'`,
      [turnoId]
    );

    // Gastos / egresos del turno
    const egresosRes = await query(
      `SELECT COALESCE(SUM(monto), 0) AS total_egresos
       FROM movimientos_caja
       WHERE turno_id = $1 AND tipo IN ('retiro', 'gasto')`,
      [turnoId]
    );

    const totales = resumenRes.rows[0];
    const totalEgresos = parseFloat(egresosRes.rows[0]?.total_egresos || 0);

    // Efectivo que debe haber en la gaveta
    const efectivoEsperado = parseFloat(turno.monto_inicial) + parseFloat(totales.total_efectivo) - totalEgresos;

    return NextResponse.json({
      turno,
      totales,
      totalEgresos,
      efectivoEsperado,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 2. Abrir o Cerrar Turno
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { accion, usuario_id, monto_inicial, turno_id, monto_declarado } = body;

    // ABRIR CAJA AL ENTRAR EL EMPLEADO
    if (accion === 'abrir') {
      if (!usuario_id) return NextResponse.json({ error: 'Usuario requerido' }, { status: 400 });

      // Si ya tiene un turno abierto, se le reasigna ese mismo
      const turnoActivo = await query(
        "SELECT * FROM turnos_caja WHERE usuario_id = $1 AND estado = 'abierto' ORDER BY id DESC LIMIT 1",
        [usuario_id]
      );
      if (turnoActivo.rows.length > 0) {
        return NextResponse.json({ turno: turnoActivo.rows[0] });
      }

      const res = await query(
        `INSERT INTO turnos_caja (usuario_id, monto_inicial, estado, fecha_apertura)
         VALUES ($1, $2, 'abierto', NOW())
         RETURNING *`,
        [usuario_id, parseFloat(monto_inicial) || 0]
      );
      return NextResponse.json({ turno: res.rows[0] });
    }

    // CERRAR CAJA Y REALIZAR ARQUEO
    if (accion === 'cerrar') {
      if (!turno_id) return NextResponse.json({ error: 'Turno requerido' }, { status: 400 });

      const calcRes = await query(
        `SELECT COALESCE(SUM(CASE WHEN metodo_pago = 'efectivo' THEN total ELSE 0 END), 0) AS ventas_efectivo
         FROM ventas 
         WHERE turno_id = $1 AND estado = 'completada'`,
        [turno_id]
      );

      const egresosRes = await query(
        `SELECT COALESCE(SUM(monto), 0) AS total_egresos
         FROM movimientos_caja
         WHERE turno_id = $1 AND tipo IN ('retiro', 'gasto')`,
        [turno_id]
      );

      const turnoData = await query('SELECT monto_inicial FROM turnos_caja WHERE id = $1', [turno_id]);
      const montoInicial = parseFloat(turnoData.rows[0]?.monto_inicial || 0);
      const ventasEfectivo = parseFloat(calcRes.rows[0]?.ventas_efectivo || 0);
      const totalEgresos = parseFloat(egresosRes.rows[0]?.total_egresos || 0);

      const montoEsperado = montoInicial + ventasEfectivo - totalEgresos;
      const declarado = parseFloat(monto_declarado) || 0;

      const res = await query(
        `UPDATE turnos_caja
         SET fecha_cierre = NOW(),
             monto_final_declarado = $1,
             monto_esperado = $2,
             estado = 'cerrado'
         WHERE id = $3
         RETURNING *`,
        [declarado, montoEsperado, turno_id]
      );

      return NextResponse.json({
        resumen: res.rows[0],
        diferencia: declarado - montoEsperado,
      });
    }

    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}