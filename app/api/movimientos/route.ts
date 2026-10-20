import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { turno_id, usuario_id, tipo, monto, motivo } = body;

    if (!turno_id || !monto || !motivo) {
      return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 });
    }

    const res = await query(
      `INSERT INTO movimientos_caja (turno_id, usuario_id, tipo, monto, motivo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [turno_id, usuario_id, tipo || 'gasto', parseFloat(monto), motivo.trim()]
    );

    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}