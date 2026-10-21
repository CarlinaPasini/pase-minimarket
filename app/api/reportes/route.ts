import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import { generarCodigoInterno } from '../../../lib/barcode';

// 1. OBTENER Y BUSCAR PRODUCTOS
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const busqueda = searchParams.get('codigo')?.trim();
  const esAutocompletar = searchParams.get('autocomplete') === 'true';

  try {
    // Si no hay búsqueda, devuelve el catálogo completo
    if (!busqueda) {
      const res = await query(
        `SELECT id, codigo_barras, nombre, precio_costo, precio_venta, stock 
         FROM productos 
         WHERE activo = TRUE 
         ORDER BY nombre ASC 
         LIMIT 3000`
      );
      return NextResponse.json(res.rows);
    }

    // A) Autocompletado dinámico en la caja
    if (esAutocompletar) {
      const res = await query(
        `SELECT id, codigo_barras, nombre, precio_venta, stock 
         FROM productos 
         WHERE activo = TRUE 
           AND (
             nombre ILIKE $1 
             OR codigo_barras ILIKE $1 
             OR $2 = ANY(string_to_array(replace(codigo_barras, ' ', ''), ','))
           )
         ORDER BY nombre ASC 
         LIMIT 10`,
        [`%${busqueda}%`, busqueda]
      );
      return NextResponse.json(res.rows);
    }

    // B) Búsqueda directa por escáner o Enter en caja
    let res = await query(
      `SELECT id, codigo_barras, nombre, precio_costo, precio_venta, stock 
       FROM productos 
       WHERE activo = TRUE 
         AND (
           codigo_barras = $1 
           OR $1 = ANY(string_to_array(replace(codigo_barras, ' ', ''), ','))
           OR codigo_barras ILIKE $2
         )
       LIMIT 1`,
      [busqueda, `%${busqueda}%`]
    );

    if (res.rows.length === 0) {
      res = await query(
        `SELECT id, codigo_barras, nombre, precio_costo, precio_venta, stock 
         FROM productos 
         WHERE activo = TRUE AND nombre ILIKE $1 
         ORDER BY nombre ASC 
         LIMIT 1`,
        [`%${busqueda}%`]
      );
    }

    if (res.rows.length === 0) {
      return NextResponse.json({ error: `Producto "${busqueda}" no encontrado` }, { status: 404 });
    }

    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    console.error('Error al consultar productos:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 2. CREAR PRODUCTO NUEVO (Sin ON CONFLICT para evitar error 23505 o exclusion constraint)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { codigo_barras, nombre, precio_costo, precio_venta, stock } = body;

    if (!nombre || !precio_venta) {
      return NextResponse.json(
        { error: 'El nombre y el precio de venta son obligatorios' },
        { status: 400 }
      );
    }

    if (!codigo_barras || codigo_barras.trim() === '') {
      const correlativo = Math.floor(100000 + Math.random() * 900000);
      codigo_barras = generarCodigoInterno(correlativo);
    } else {
      codigo_barras = codigo_barras.trim();
    }

    // Comprobar si ya existe un producto con el mismo nombre para actualizarlo
    const existente = await query(
      `SELECT id FROM productos WHERE LOWER(TRIM(nombre)) = LOWER(TRIM($1)) LIMIT 1`,
      [nombre.trim()]
    );

    let res;
    if (existente.rows.length > 0) {
      res = await query(
        `UPDATE productos 
         SET codigo_barras = $1, precio_costo = $2, precio_venta = $3, stock = $4, activo = TRUE, updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [codigo_barras, parseFloat(precio_costo) || 0, parseFloat(precio_venta), parseFloat(stock) || 0, existente.rows[0].id]
      );
    } else {
      res = await query(
        `INSERT INTO productos (codigo_barras, nombre, precio_costo, precio_venta, stock, activo)
         VALUES ($1, $2, $3, $4, $5, TRUE)
         RETURNING *`,
        [codigo_barras, nombre.trim(), parseFloat(precio_costo) || 0, parseFloat(precio_venta), parseFloat(stock) || 0]
      );
    }

    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    console.error('Error al guardar producto:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 3. ACTUALIZAR PRODUCTO POR ID (al presionar el lápiz de edición)
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, codigo_barras, nombre, precio_costo, precio_venta, stock } = body;

    if (!id || !nombre || !precio_venta) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const res = await query(
      `UPDATE productos 
       SET codigo_barras = $1, nombre = $2, precio_costo = $3, precio_venta = $4, stock = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [codigo_barras, nombre.trim(), parseFloat(precio_costo) || 0, parseFloat(precio_venta), parseFloat(stock) || 0, id]
    );

    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 4. ELIMINAR / DESACTIVAR PRODUCTO
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    await query('UPDATE productos SET activo = FALSE WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}