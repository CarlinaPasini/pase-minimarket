'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, X, ShoppingBag, Eye, Calendar, Clock, UserCheck } from 'lucide-react';

interface TurnoAuditoria {
  id: number;
  fecha_apertura: string;
  fecha_cierre: string | null;
  monto_inicial: string | number;
  monto_esperado: string | number | null;
  monto_final_declarado: string | number | null;
  diferencia_arqueo: string | number | null;
  estado: string;
  cajero: string;
  rol: string;
  total_ventas: string | number;
  cantidad_ventas: string | number;
}

interface ItemDetalleTurno {
  venta_id: string;
  fecha: string;
  total_venta: string | number;
  metodo_pago: string;
  producto: string;
  codigo_barras: string;
  cantidad: number;
  precio_unitario: string | number;
  subtotal: string | number;
}

interface VentaItem {
  id: string;
  fecha: string;
  total: string | number;
  metodo_pago: string;
  turno_id: number;
  cajero: string;
}

export default function PantallaReportes() {
  const [turnos, setTurnos] = useState<TurnoAuditoria[]>([]);
  const [ventas, setVentas] = useState<VentaItem[]>([]);
  const [cajeroFiltro, setCajeroFiltro] = useState('todos');
  const [pestaña, setPestaña] = useState<'turnos' | 'ventas'>('turnos');
  const [cargando, setCargando] = useState(false);

  // Estados para ver el detalle de productos de un turno seleccionado
  const [turnoSeleccionado, setTurnoSeleccionado] = useState<TurnoAuditoria | null>(null);
  const [itemsTurno, setItemsTurno] = useState<ItemDetalleTurno[]>([]);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const res = await fetch('/api/reportes');
      if (res.ok) {
        const data = await res.json();
        setTurnos(data.turnos || []);
        setVentas(data.ventas || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const verDetalleTurno = async (turno: TurnoAuditoria) => {
    setTurnoSeleccionado(turno);
    setCargandoDetalle(true);
    try {
      const res = await fetch(`/api/reportes?turno_id=${turno.id}`);
      if (res.ok) {
        const data = await res.json();
        setItemsTurno(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCargandoDetalle(false);
    }
  };

  const cajerosDisponibles = Array.from(new Set(turnos.map((t) => t.cajero)));

  const turnosFiltrados = cajeroFiltro === 'todos'
    ? turnos
    : turnos.filter((t) => t.cajero === cajeroFiltro);

  const ventasFiltradas = cajeroFiltro === 'todos'
    ? ventas
    : ventas.filter((v) => v.cajero === cajeroFiltro);

  const totalFacturado = turnosFiltrados.reduce((acc, t) => acc + parseFloat(String(t.total_ventas || 0)), 0);
  const cajasAbiertas = turnos.filter((t) => t.estado === 'abierto').length;

  return (
    <div className="min-h-screen bg-slate-100 font-sans p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Encabezado Superior con Logo PASE y Navegación de Dueño */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-2xl shadow-sm gap-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <Link 
              href="/caja" 
              className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 transition"
              title="Volver a Caja"
            >
              <ArrowLeft size={20} />
            </Link>
            
            <div className="w-10 h-10 rounded-full overflow-hidden bg-black flex-shrink-0 border border-slate-200 shadow-sm flex items-center justify-center">
              <img src="/logo.jpeg" alt="PASE" className="w-full h-full object-cover" />
            </div>

            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">PASE MINIMARKET — Control de Caja</h1>
              <p className="text-xs text-slate-400">Supervisión de turnos, arqueos de empleados y ventas en vivo</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
            <Link
              href="/productos"
              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs transition"
            >
              Inventario
            </Link>
            <Link
              href="/usuarios"
              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs transition"
            >
              Personal y PINs
            </Link>

            <select
              value={cajeroFiltro}
              onChange={(e) => setCajeroFiltro(e.target.value)}
              className="p-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs text-slate-700"
            >
              <option value="todos">Todos los Empleados</option>
              {cajerosDisponibles.map((nombre) => (
                <option key={nombre} value={nombre}>{nombre}</option>
              ))}
            </select>

            <button
              onClick={cargarDatos}
              disabled={cargando}
              className="p-2 bg-black hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition"
            >
              <RefreshCw size={14} className={cargando ? 'animate-spin' : ''} /> Actualizar
            </button>

            <button
              onClick={() => {
                window.location.href = '/caja';
              }}
              className="p-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl font-bold text-xs transition"
              title="Salir de la sesión y volver al PIN"
            >
              Salir
            </button>
          </div>
        </div>

        {/* Tarjetas de Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <span className="text-xs uppercase font-bold text-slate-400">Total Facturado</span>
            <p className="text-3xl font-black text-emerald-600 mt-1">${totalFacturado.toLocaleString()}</p>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <span className="text-xs uppercase font-bold text-slate-400">Cajas Operando Ahora</span>
            <p className="text-3xl font-black text-blue-600 mt-1 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
              {cajasAbiertas} activa(s)
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <span className="text-xs uppercase font-bold text-slate-400">Filtro de Empleado</span>
            <p className="text-2xl font-black text-slate-800 mt-1 truncate">
              {cajeroFiltro === 'todos' ? 'Todos los cajeros' : cajeroFiltro}
            </p>
          </div>
        </div>

        {/* Selector de Pestañas */}
        <div className="flex gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setPestaña('turnos')}
            className={`px-5 py-2.5 rounded-xl font-black text-sm transition ${
              pestaña === 'turnos' ? 'bg-slate-900 text-white shadow' : 'bg-white text-slate-600 hover:bg-slate-200'
            }`}
          >
            Arqueos y Cajas por Turno ({turnosFiltrados.length})
          </button>
          <button
            onClick={() => setPestaña('ventas')}
            className={`px-5 py-2.5 rounded-xl font-black text-sm transition ${
              pestaña === 'ventas' ? 'bg-slate-900 text-white shadow' : 'bg-white text-slate-600 hover:bg-slate-200'
            }`}
          >
            Detalle Ticket por Ticket ({ventasFiltradas.length})
          </button>
        </div>

        {/* TABLA DE TURNOS CON DÍA Y HORA */}
        {pestaña === 'turnos' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-xs bg-slate-50">
                    <th className="py-3 px-4">Turno</th>
                    <th className="py-3 px-4">Cajero</th>
                    <th className="py-3 px-4">Apertura (Día / Hora)</th>
                    <th className="py-3 px-4">Cierre (Día / Hora)</th>
                    <th className="py-3 px-4 text-right">Fondo Inicial</th>
                    <th className="py-3 px-4 text-right">Ventas</th>
                    <th className="py-3 px-4 text-right">Esperado</th>
                    <th className="py-3 px-4 text-right">Contado</th>
                    <th className="py-3 px-4 text-center">Diferencia</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {turnosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center py-8 text-slate-400 font-bold">
                        No hay turnos registrados aún
                      </td>
                    </tr>
                  ) : (
                    turnosFiltrados.map((t) => {
                      const dif = parseFloat(String(t.diferencia_arqueo || 0));
                      return (
                        <tr
                          key={t.id}
                          onClick={() => verDetalleTurno(t)}
                          className="hover:bg-blue-50/60 cursor-pointer transition group"
                        >
                          <td className="py-3 px-4 font-black text-blue-600 group-hover:underline">#{t.id}</td>
                          <td className="py-3 px-4 font-bold text-slate-800">
                            {t.cajero}
                            <span className="block text-xs font-normal text-slate-400 capitalize">{t.rol}</span>
                          </td>
                          <td className="py-3 px-4 text-xs font-mono text-slate-600 whitespace-nowrap">
                            <span className="font-bold text-slate-800">
                              {new Date(t.fecha_apertura).toLocaleDateString([], { day: '2-digit', month: '2-digit' })}
                            </span>{' '}
                            {new Date(t.fecha_apertura).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3 px-4 text-xs font-mono text-slate-600 whitespace-nowrap">
                            {t.fecha_cierre ? (
                              <>
                                <span className="font-bold text-slate-800">
                                  {new Date(t.fecha_cierre).toLocaleDateString([], { day: '2-digit', month: '2-digit' })}
                                </span>{' '}
                                {new Date(t.fecha_cierre).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-700">
                            ${parseFloat(String(t.monto_inicial)).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                            ${parseFloat(String(t.total_ventas)).toLocaleString()} ({t.cantidad_ventas})
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                            {t.monto_esperado ? `$${parseFloat(String(t.monto_esperado)).toLocaleString()}` : '-'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                            {t.monto_final_declarado ? `$${parseFloat(String(t.monto_final_declarado)).toLocaleString()}` : '-'}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {t.estado === 'abierto' ? (
                              <span className="text-xs text-slate-400 italic">En curso</span>
                            ) : dif === 0 ? (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-black rounded-lg text-xs">
                                Exacto ($0)
                              </span>
                            ) : dif < 0 ? (
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-black rounded-lg text-xs">
                                Faltante: ${Math.abs(dif).toLocaleString()}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-black rounded-lg text-xs">
                                Sobrante: +${dif.toLocaleString()}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                              t.estado === 'abierto' ? 'bg-emerald-100 text-emerald-700 animate-pulse' : 'bg-slate-200 text-slate-600'
                            }`}>
                              {t.estado}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition">
                              <Eye size={14} /> Ver artículos
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TABLA DE VENTAS INDIVIDUALES */}
        {pestaña === 'ventas' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-xs bg-slate-50">
                    <th className="py-3 px-4">Fecha / Hora</th>
                    <th className="py-3 px-4">Cajero</th>
                    <th className="py-3 px-4">Turno</th>
                    <th className="py-3 px-4">Método de Pago</th>
                    <th className="py-3 px-4 text-right">Total Cobrado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ventasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-400 font-bold">
                        No hay ventas registradas
                      </td>
                    </tr>
                  ) : (
                    ventasFiltradas.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                          {new Date(v.fecha).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">{v.cajero}</td>
                        <td className="py-3 px-4 font-bold text-slate-500">#{v.turno_id || '-'}</td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-black uppercase text-slate-700">
                            {v.metodo_pago}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-lg text-slate-900">
                          ${parseFloat(String(v.total)).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* MODAL DETALLE DE PRODUCTOS VENDIDOS EN EL TURNO SELECCIONADO */}
      {turnoSeleccionado && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-3xl rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
            
            {/* Cabecera del modal */}
            <div className="flex justify-between items-start border-b pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-black text-slate-800">
                    Detalle del Turno #{turnoSeleccionado.id}
                  </h2>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                    turnoSeleccionado.estado === 'abierto' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {turnoSeleccionado.estado}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  Cajero: <b className="text-slate-800">{turnoSeleccionado.cajero}</b> ({turnoSeleccionado.rol})
                </p>
              </div>
              <button
                onClick={() => setTurnoSeleccionado(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                <X size={24} />
              </button>
            </div>

            {/* Resumen monetario del turno */}
            <div className="grid grid-cols-3 gap-3 mb-4 bg-slate-50 p-3.5 rounded-2xl border text-sm">
              <div>
                <span className="text-xs text-slate-400 font-bold uppercase block">Fondo Inicial</span>
                <span className="text-lg font-black text-slate-700">
                  ${parseFloat(String(turnoSeleccionado.monto_inicial)).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400 font-bold uppercase block">Total Vendido</span>
                <span className="text-lg font-black text-emerald-600">
                  ${parseFloat(String(turnoSeleccionado.total_ventas)).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400 font-bold uppercase block">Operaciones</span>
                <span className="text-lg font-black text-slate-800">
                  {turnoSeleccionado.cantidad_ventas} ticket(s)
                </span>
              </div>
            </div>

            {/* Listado de artículos vendidos con fecha y hora completa */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl">
              {cargandoDetalle ? (
                <div className="p-8 text-center text-slate-400 font-bold flex items-center justify-center gap-2">
                  <RefreshCw size={18} className="animate-spin" /> Cargando productos vendidos...
                </div>
              ) : itemsTurno.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-bold">
                  Este turno no registró ventas de artículos todavía.
                </div>
              ) : (
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-xs bg-slate-50 sticky top-0">
                      <th className="py-2.5 px-3">Fecha y Hora</th>
                      <th className="py-2.5 px-3">Artículo Vendido</th>
                      <th className="py-2.5 px-3 text-center">Pago</th>
                      <th className="py-2.5 px-3 text-right">Cant.</th>
                      <th className="py-2.5 px-3 text-right">Unitario</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itemsTurno.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-xs font-mono text-slate-600 whitespace-nowrap">
                          <span className="font-bold text-slate-800">
                            {new Date(item.fecha).toLocaleDateString([], { day: '2-digit', month: '2-digit' })}
                          </span>{' '}
                          {new Date(item.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-bold text-slate-800">{item.producto}</p>
                          <span className="text-xs font-mono text-slate-400">{item.codigo_barras}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-bold rounded capitalize">
                            {item.metodo_pago}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-800">
                          {item.cantidad}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          ${parseFloat(String(item.precio_unitario)).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900 font-mono">
                          ${parseFloat(String(item.subtotal)).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pie del modal */}
            <div className="pt-4 mt-2 flex justify-end">
              <button
                onClick={() => setTurnoSeleccionado(null)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition"
              >
                Cerrar Detalle
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}