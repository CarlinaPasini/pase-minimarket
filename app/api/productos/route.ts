import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import { generarCodigoInterno } from '../../../lib/barcode';

// 1. OBTENER Y BUSCAR PRODUCTOS
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const busqueda = searchParams.get('codigo')?.trim();
  const esAutocompletar = searchParams.get('autocomplete') === 'true';

  try {
    // Si no hay término de búsqueda, devolvemos los primeros 100 ordenados
    if (!busqueda) {
      const res = await query(
        `SELECT id, codigo_barras, nombre, precio_costo, precio_venta, stock 
         FROM productos 
         WHERE activo = TRUE 
         ORDER BY nombre ASC 
         LIMIT 80000`
      );
      return NextResponse.json(res.rows);
    }

    // A) Búsqueda para el autocompletado en la Caja (dropdown rápido)
    if (esAutocompletar) {
      const res = await query(
        `SELECT id, codigo_barras, nombre, precio_venta, stock 
         FROM productos 
         WHERE activo = TRUE 
           AND (nombre ILIKE $1 OR codigo_barras LIKE $2)
         ORDER BY nombre ASC 
         LIMIT 10`,
        [`%${busqueda}%`, `${busqueda}%`]
      );
      return NextResponse.json(res.rows);
    }

    // B) Búsqueda para el Catálogo / Inventario o escaneo de Caja:
    // Si la búsqueda coincide con un código de barras exacto:
    let resExacto = await query(
      `SELECT id, codigo_barras, nombre, precio_costo, precio_venta, stock 
       FROM productos 
       WHERE codigo_barras = $1 AND activo = TRUE`,
      [busqueda]
    );

    if (resExacto.rows.length > 0) {
      // Si la llamada espera un listado o un elemento individual
      return NextResponse.json(resExacto.rows);
    }

    // C) Búsqueda amplia por coincidencia de texto en el nombre o código
    const resLista = await query(
      `SELECT id, codigo_barras, nombre, precio_costo, precio_venta, stock 
       FROM productos 
       WHERE activo = TRUE 
         AND (nombre ILIKE $1 OR codigo_barras ILIKE $1)
       ORDER BY nombre ASC 
       LIMIT 100`,
      [`%${busqueda}%`]
    );

    return NextResponse.json(resLista.rows);
  } catch (error: any) {
    console.error('Error al consultar productos:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 2. REGISTRAR PRODUCTO NUEVO
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

    const res = await query(
      `INSERT INTO productos (codigo_barras, nombre, precio_costo, precio_venta, stock, activo)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       ON CONFLICT (codigo_barras) DO UPDATE 
       SET nombre = EXCLUDED.nombre,
           precio_costo = EXCLUDED.precio_costo,
           precio_venta = EXCLUDED.precio_venta,
           stock = EXCLUDED.stock,
           activo = TRUE
       RETURNING *`,
      [codigo_barras, nombre.trim(), parseFloat(precio_costo) || 0, parseFloat(precio_venta), parseFloat(stock) || 0]
    );

    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    console.error('Error al guardar producto:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 3. ACTUALIZAR PRODUCTO (Precios, Costos o Stock)
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