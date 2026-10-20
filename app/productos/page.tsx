'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PackagePlus, RefreshCw, CheckCircle, AlertCircle, Barcode, Edit2, Trash2, ArrowLeft, Search } from 'lucide-react';

interface Producto {
  id: string;
  codigo_barras: string;
  nombre: string;
  precio_costo: number;
  precio_venta: number;
  stock: number;
}

export default function GestionProductos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [busqueda, setBusqueda] = useState('');
  
  // Estados del formulario
  const [idEditando, setIdEditando] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [codigoBarras, setCodigoBarras] = useState('');
  const [precioCosto, setPrecioCosto] = useState('');
  const [precioVenta, setPrecioVenta] = useState('');
  const [stock, setStock] = useState('10');
  
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [cargando, setCargando] = useState(false);

  const cargarProductos = async (filtro = '') => {
    try {
      const url = filtro.trim() 
        ? `/api/productos?codigo=${encodeURIComponent(filtro.trim())}` 
        : '/api/productos';
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data)) {
        setProductos(data);
      } else if (data && data.id) {
        setProductos([data]);
      } else {
        setProductos([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Carga inicial
  useEffect(() => {
    cargarProductos();
  }, []);

  // Búsqueda en vivo en la base de datos al tipear
  useEffect(() => {
    const timer = setTimeout(() => {
      cargarProductos(busqueda);
    }, 200);

    return () => clearTimeout(timer);
  }, [busqueda]);

  const generarCodigoAutomatico = () => {
    const correlativo = Math.floor(100000 + Math.random() * 900000);
    const cuerpo = '20' + String(correlativo).padStart(10, '0');
    let suma = 0;
    for (let i = 0; i < 12; i++) {
      const d = parseInt(cuerpo[i], 10);
      suma += (i % 2 === 0) ? d : d * 3;
    }
    const residuo = suma % 10;
    const verificador = residuo === 0 ? 0 : 10 - residuo;
    setCodigoBarras(`${cuerpo}${verificador}`);
  };

  const seleccionarParaEditar = (prod: Producto) => {
    setIdEditando(prod.id);
    setNombre(prod.nombre);
    setCodigoBarras(prod.codigo_barras);
    setPrecioCosto(String(prod.precio_costo));
    setPrecioVenta(String(prod.precio_venta));
    setStock(String(prod.stock));
    setMensaje(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarEdicion = () => {
    setIdEditando(null);
    setNombre('');
    setCodigoBarras('');
    setPrecioCosto('');
    setPrecioVenta('');
    setStock('10');
    setMensaje(null);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje(null);

    if (!nombre.trim() || !precioVenta) {
      setMensaje({ tipo: 'error', texto: 'El nombre y el precio de venta son requeridos.' });
      return;
    }

    setCargando(true);
    try {
      const metodo = idEditando ? 'PUT' : 'POST';
      const res = await fetch('/api/productos', {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: idEditando,
          codigo_barras: codigoBarras.trim() || null,
          nombre: nombre.trim(),
          precio_costo: parseFloat(precioCosto) || 0,
          precio_venta: parseFloat(precioVenta),
          stock: parseFloat(stock) || 0,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al guardar');
      }

      setMensaje({ 
        tipo: 'ok', 
        texto: idEditando ? '¡Producto actualizado correctamente!' : '¡Producto guardado exitosamente!' 
      });
      cancelarEdicion();
      cargarProductos(busqueda);
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message || 'Error en la operación' });
    } finally {
      setCargando(false);
    }
  };

  const handleEliminar = async (id: string, nombreProd: string) => {
    if (!confirm(`¿Seguro que deseas eliminar "${nombreProd}" del catálogo?`)) return;

    try {
      const res = await fetch(`/api/productos?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMensaje({ tipo: 'ok', texto: `"${nombreProd}" eliminado del catálogo.` });
        cargarProductos(busqueda);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans p-6">
      {/* Navegación Superior con Logo PASE */}
      <div className="max-w-7xl mx-auto flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm mb-6 border border-slate-200">
        <div className="flex items-center gap-3">
          <Link href="/caja" className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition">
            <ArrowLeft size={20} />
          </Link>
          
          <div className="w-10 h-10 rounded-full overflow-hidden bg-black flex-shrink-0 border border-slate-200 shadow-sm flex items-center justify-center">
            <img src="/logo.jpeg" alt="PASE" className="w-full h-full object-cover" />
          </div>

          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">PASE MINIMARKET — Catálogo y Stock</h1>
            <p className="text-xs text-slate-400">Administración de precios, costos e inventario</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <Link href="/caja" className="px-4 py-2 bg-black hover:bg-slate-800 text-white font-bold rounded-xl transition text-sm">
            Ir a Caja Registradora
          </Link>
          <Link href="/etiquetas" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition flex items-center gap-2 text-sm border border-slate-200">
            <Barcode size={16} /> Etiquetas
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario de Carga / Modificación */}
        <div className="bg-white p-6 rounded-2xl shadow-sm lg:col-span-1 h-fit sticky top-6 border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2">
            <PackagePlus className="text-blue-600" /> 
            {idEditando ? 'Modificar Producto' : 'Cargar Producto Nuevo'}
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            {idEditando ? 'Edite los precios o stock y guarde los cambios.' : 'Agregue nuevos productos al sistema sin usar la base.'}
          </p>

          {mensaje && (
            <div className={`p-3 rounded-xl mb-4 text-sm font-bold flex items-center gap-2 ${mensaje.tipo === 'ok' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
              {mensaje.tipo === 'ok' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
              {mensaje.texto}
            </div>
          )}

          <form onSubmit={handleGuardar} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                Código de Barras <span className="font-normal text-slate-400">(Opcional)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={codigoBarras}
                  onChange={(e) => setCodigoBarras(e.target.value)}
                  placeholder="Escanee o genere..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={generarCodigoAutomatico}
                  className="px-3 bg-slate-200 hover:bg-slate-300 rounded-xl transition"
                  title="Generar código automático EAN-13"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Nombre / Descripción</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Alfajor Jorgito Chocolate"
                className="w-full p-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Precio Costo ($)</label>
                <input
                  type="number"
                  value={precioCosto}
                  onChange={(e) => setPrecioCosto(e.target.value)}
                  placeholder="0"
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Precio Venta ($)</label>
                <input
                  type="number"
                  value={precioVenta}
                  onChange={(e) => setPrecioVenta(e.target.value)}
                  placeholder="0"
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Stock Disponible</label>
              <input
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              {idEditando && (
                <button
                  type="button"
                  onClick={cancelarEdicion}
                  className="w-1/3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 rounded-xl transition"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={cargando}
                className={`w-full font-bold py-3 rounded-xl transition shadow active:scale-95 ${
                  idEditando ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {cargando ? 'Procesando...' : idEditando ? 'Guardar Cambios' : 'Registrar Producto'}
              </button>
            </div>
          </form>
        </div>

        {/* Listado con Buscador Dinámico */}
        <div className="bg-white p-6 rounded-2xl shadow-sm lg:col-span-2 flex flex-col border border-slate-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <h2 className="text-xl font-bold text-slate-800">Catálogo ({productos.length})</h2>
            
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o código..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                autoFocus
              />
              <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-xs bg-slate-50 sticky top-0">
                  <th className="py-2.5 px-3">Código</th>
                  <th className="py-2.5 px-3">Descripción</th>
                  <th className="py-2.5 px-3 text-right">Costo</th>
                  <th className="py-2.5 px-3 text-right">Venta</th>
                  <th className="py-2.5 px-3 text-right">Stock</th>
                  <th className="py-2.5 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400 font-bold">
                      No se encontraron productos con esa descripción o código.
                    </td>
                  </tr>
                ) : (
                  productos.map((prod) => (
                    <tr key={prod.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3 font-mono text-slate-600 text-xs">{prod.codigo_barras}</td>
                      <td className="py-3 px-3 font-semibold text-slate-800">{prod.nombre}</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-500">${parseFloat(String(prod.precio_costo || 0)).toLocaleString()}</td>
                      <td className="py-3 px-3 text-right font-black text-slate-900">${parseFloat(String(prod.precio_venta)).toLocaleString()}</td>
                      <td className="py-3 px-3 text-right">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${Number(prod.stock) <= 5 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                          {prod.stock}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex justify-center gap-1.5">
                          <button
                            onClick={() => seleccionarParaEditar(prod)}
                            className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition"
                            title="Modificar precio o stock"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleEliminar(prod.id, prod.nombre)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition"
                            title="Eliminar del catálogo"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}