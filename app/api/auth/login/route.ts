import { NextResponse } from 'next/server';
import { query } from '../../../../lib/db';

export async function POST(request: Request) {
  try {
    const { usuario, password, pin } = await request.json();

    let res;
    if (pin) {
      // Login rápido por PIN en caja
      res = await query(
        'SELECT id, nombre, usuario, rol FROM usuarios WHERE pin_cajero = $1 AND activo = TRUE',
        [pin]
      );
    } else {
      // Login estándar por usuario y contraseña
      res = await query(
        'SELECT id, nombre, usuario, rol FROM usuarios WHERE (usuario = $1 OR nombre ILIKE $1) AND password_hash = $2 AND activo = TRUE',
        [usuario, password]
      );
    }

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Credenciales inválidas o usuario inactivo' }, { status: 401 });
    }

    const user = res.rows[0];

    // Verificar si el usuario tiene un turno de caja abierto
    const turnoRes = await query(
      'SELECT id, fecha_apertura, monto_inicial FROM turnos_caja WHERE usuario_id = $1 AND estado = $2 ORDER BY id DESC LIMIT 1',
      [user.id, 'abierto']
    );

    return NextResponse.json({
      user,
      turno: turnoRes.rows[0] || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}