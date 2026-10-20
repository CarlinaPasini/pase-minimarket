import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';

// 1. OBTENER RESUMEN DE VENTAS Y EGRESOS DEL TURNO
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

    // Totales de ventas agrupados por medio de pago
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

    // Total de egresos/gastos registrados durante el turno
    const egresosRes = await query(
      `SELECT COALESCE(SUM(monto), 0) AS total_egresos
       FROM movimientos_caja
       WHERE turno_id = $1 AND tipo IN ('retiro', 'gasto')`,
      [turnoId]
    );

    const totales = resumenRes.rows[0];
    const totalEgresos = parseFloat(egresosRes.rows[0]?.total_egresos || 0);

    // Efectivo esperado = Fondo Inicial + Ventas en Efectivo - Gastos/Retiros
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

// 2. ABRIR Y CERRAR TURNO (ARQUEO)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { accion, usuario_id, monto_inicial, turno_id, monto_declarado } = body;

    // A) APERTURA DE TURNO
    if (accion === 'abrir') {
      if (!usuario_id) {
        return NextResponse.json({ error: 'Falta usuario_id' }, { status: 400 });
      }

      // Verificar si ya tiene un turno abierto previo
      const turnoActivo = await query(
        'SELECT * FROM turnos_caja WHERE usuario_id = $1 AND estado = $2 LIMIT 1',
        [usuario_id, 'abierto']
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

    // B) CIERRE DE TURNO Y ARQUEO
    if (accion === 'cerrar') {
      if (!turno_id) {
        return NextResponse.json({ error: 'Falta turno_id' }, { status: 400 });
      }

      // 1. Obtener ventas en efectivo
      const calcRes = await query(
        `SELECT 
           COALESCE(SUM(CASE WHEN metodo_pago = 'efectivo' THEN total ELSE 0 END), 0) AS ventas_efectivo
         FROM ventas 
         WHERE turno_id = $1 AND estado = 'completada'`,
        [turno_id]
      );

      // 2. Obtener gastos/retiros del turno
      const egresosRes = await query(
        `SELECT COALESCE(SUM(monto), 0) AS total_egresos
         FROM movimientos_caja
         WHERE turno_id = $1 AND tipo IN ('retiro', 'gasto')`,
        [turno_id]
      );

      // 3. Obtener monto inicial
      const turnoData = await query('SELECT monto_inicial FROM turnos_caja WHERE id = $1', [turno_id]);
      if (turnoData.rows.length === 0) {
        return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
      }

      const montoInicial = parseFloat(turnoData.rows[0]?.monto_inicial || 0);
      const ventasEfectivo = parseFloat(calcRes.rows[0]?.ventas_efectivo || 0);
      const totalEgresos = parseFloat(egresosRes.rows[0]?.total_egresos || 0);

      // Efectivo real que debe haber en gaveta
      const montoEsperado = montoInicial + ventasEfectivo - totalEgresos;
      const declarado = parseFloat(monto_declarado) || 0;

      // 4. Cerrar turno en base de datos
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