import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';

// 1. LISTAR USUARIOS
export async function GET() {
  try {
    const res = await query(
      `SELECT id, nombre, usuario, pin_cajero, rol, activo, created_at 
       FROM usuarios 
       ORDER BY 
         CASE 
           WHEN rol = 'admin' THEN 1 
           WHEN rol = 'encargado' THEN 2 
           ELSE 3 
         END, 
         nombre ASC`
    );
    return NextResponse.json(res.rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 2. CREAR NUEVO USUARIO
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nombre, usuario, pin, rol } = body;

    if (!nombre || !usuario || !pin) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    // Verificar si el PIN ya está en uso por otro empleado activo
    const checkPin = await query(
      'SELECT id, nombre FROM usuarios WHERE pin_cajero = $1 AND activo = TRUE',
      [pin]
    );
    if (checkPin.rows.length > 0) {
      return NextResponse.json(
        { error: `El PIN ${pin} ya lo está usando ${checkPin.rows[0].nombre}` },
        { status: 400 }
      );
    }

    const res = await query(
      `INSERT INTO usuarios (nombre, usuario, password_hash, pin_cajero, rol, activo)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING id, nombre, usuario, pin_cajero, rol, activo`,
      [nombre.trim(), usuario.trim().toLowerCase(), '123456', pin.trim(), rol || 'cajero']
    );

    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'El nombre de usuario ya existe' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 3. MODIFICAR USUARIO O CAMBIAR PIN
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, nombre, pin, rol, activo } = body;

    if (!id || !nombre || !pin) {
      return NextResponse.json({ error: 'ID, nombre y PIN son obligatorios' }, { status: 400 });
    }

    // Verificar que no repita el PIN de otro usuario activo
    const checkPin = await query(
      'SELECT id, nombre FROM usuarios WHERE pin_cajero = $1 AND id != $2 AND activo = TRUE',
      [pin, id]
    );
    if (checkPin.rows.length > 0) {
      return NextResponse.json(
        { error: `El PIN ${pin} ya lo está usando ${checkPin.rows[0].nombre}` },
        { status: 400 }
      );
    }

    const res = await query(
      `UPDATE usuarios 
       SET nombre = $1, pin_cajero = $2, rol = $3, activo = $4
       WHERE id = $5
       RETURNING id, nombre, usuario, pin_cajero, rol, activo`,
      [nombre.trim(), pin.trim(), rol, activo, id]
    );

    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 4. DESACTIVAR USUARIO (Baja de empleado)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    // Evitar que el admin principal se borre a sí mismo
    const checkUser = await query('SELECT rol FROM usuarios WHERE id = $1', [id]);
    if (checkUser.rows[0]?.rol === 'admin') {
      const totalAdmins = await query("SELECT count(*) FROM usuarios WHERE rol = 'admin' AND activo = TRUE");
      if (parseInt(totalAdmins.rows[0].count) <= 1) {
        return NextResponse.json({ error: 'No puedes desactivar al único Administrador' }, { status: 400 });
      }
    }

    await query('UPDATE usuarios SET activo = FALSE WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}