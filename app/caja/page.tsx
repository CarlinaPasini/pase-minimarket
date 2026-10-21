'use client';

import { useState, useEffect, useRef } from 'react';
import {
  ShoppingCart, Trash2, CreditCard, DollarSign, Smartphone,
  AlertCircle, CheckCircle, Split, Search, UserCheck, LogOut, Lock,
  Package, Barcode, Key, MinusCircle, Printer, Plus, Minus
} from 'lucide-react';

interface Producto {
  id: string;
  codigo_barras: string;
  nombre: string;
  precio_venta: number;
  stock: number;
}

interface ItemVenta {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
}

export default function CajaPOS() {
  const [items, setItems] = useState<ItemVenta[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [montoRecibido, setMontoRecibido] = useState('');
  const [cargando, setCargando] = useState(false);

  // Modales
  const [modalMixto, setModalMixto] = useState(false);
  const [pagoEfectivo, setPagoEfectivo] = useState('');
  const [pagoTarjeta, setPagoTarjeta] = useState('');
  const [pagoTransferencia, setPagoTransferencia] = useState('');

  const [modalGasto, setModalGasto] = useState(false);
  const [montoGasto, setMontoGasto] = useState('');
  const [motivoGasto, setMotivoGasto] = useState('');

  const [modalCierre, setModalCierre] = useState(false);
  const [montoDeclarado, setMontoDeclarado] = useState('');
  const [resumenCierre, setResumenCierre] = useState<any>(null);

  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const inputBusquedaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputBusquedaRef.current?.focus();
  }, [items]);

  const total = items.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
  const recibidoNum = parseFloat(montoRecibido) || 0;
  const vuelto = recibidoNum > total ? recibidoNum - total : 0;

  // Búsqueda y agregado de producto
  const handleBuscar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!busqueda.trim()) return;

    try {
      const res = await fetch(`/api/productos?codigo=${encodeURIComponent(busqueda.trim())}`);
      if (res.ok) {
        const prod: Producto = await res.json();
        setItems(prev => {
          const existe = prev.find(p => p.id === prod.id);
          if (existe) {
            return prev.map(p => p.id === prod.id ? { ...p, cantidad: p.cantidad + 1 } : p);
          }
          return [...prev, { id: prod.id, nombre: prod.nombre, precio: parseFloat(String(prod.precio_venta)), cantidad: 1 }];
        });
        setBusqueda('');
      } else {
        alert('Producto no encontrado');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const modificarCantidad = (id: string, delta: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const nueva = item.cantidad + delta;
        return nueva > 0 ? { ...item, cantidad: nueva } : null;
      }
      return item;
    }).filter(Boolean) as ItemVenta[]);
  };

  // Procesar cobro único
  const procesarCobro = async (metodo: string) => {
    if (items.length === 0 || cargando) return;
    setCargando(true);

    try {
      const res = await fetch('/api/ventas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          metodo_pago: metodo,
          monto_recibido: metodo === 'efectivo' ? (recibidoNum || total) : total,
          total,
          vuelto: metodo === 'efectivo' ? vuelto : 0
        }),
      });

      if (res.ok) {
        setItems([]);
        setMontoRecibido('');
        setMensajeExito(`¡Cobro de $${total.toLocaleString()} registrado con éxito!`);
        setTimeout(() => setMensajeExito(null), 3000);
      } else {
        alert('Error al registrar la venta');
      }
    } catch (err) {
      console.error(err);
      alert('Error de red al cobrar');
    } finally {
      setCargando(false);
    }
  };

  // Procesar cobro mixto
  const procesarCobroMixto = async () => {
    const ef = parseFloat(pagoEfectivo) || 0;
    const tj = parseFloat(pagoTarjeta) || 0;
    const tr = parseFloat(pagoTransferencia) || 0;
    const suma = ef + tj + tr;

    if (Math.round(suma) < Math.round(total)) {
      alert(`El monto ingresado ($${suma}) no cubre el total ($${total})`);
      return;
    }

    setCargando(true);
    try {
      const pagos = [
        { metodo: 'efectivo', monto: ef },
        { metodo: 'tarjeta', monto: tj },
        { metodo: 'transferencia', monto: tr }
      ].filter(p => p.monto > 0);

      const res = await fetch('/api/ventas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          metodo_pago: 'mixto',
          total,
          pagos,
          monto_recibido: suma,
          vuelto: suma > total ? suma - total : 0
        }),
      });

      if (res.ok) {
        setItems([]);
        setModalMixto(false);
        setPagoEfectivo('');
        setPagoTarjeta('');
        setPagoTransferencia('');
        setMensajeExito(`¡Pago mixto de $${total.toLocaleString()} completado!`);
        setTimeout(() => setMensajeExito(null), 3000);
      } else {
        alert('Error al registrar pago mixto');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión');
    } finally {
      setCargando(false);
    }
  };

  // Registrar retiro / gasto
  const handleRegistrarGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!montoGasto || !motivoGasto.trim()) return;

    try {
      const res = await fetch('/api/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'gasto',
          monto: parseFloat(montoGasto),
          motivo: motivoGasto.trim(),
        }),
      });

      if (res.ok) {
        alert('Retiro de caja registrado.');
        setModalGasto(false);
        setMontoGasto('');
        setMotivoGasto('');
      } else {
        alert('Error al registrar el retiro');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Cierre de caja
  const handleAbrirCierre = async () => {
    try {
      const res = await fetch('/api/turnos?accion=resumen');
      if (res.ok) {
        const data = await res.json();
        setResumenCierre(data);
        setModalCierre(true);
      } else {
        setModalCierre(true);
      }
    } catch {
      setModalCierre(true);
    }
  };

  const handleConfirmarCierre = async () => {
    if (!montoDeclarado) {
      alert('Ingrese el monto contado en caja');
      return;
    }
    try {
      const res = await fetch('/api/turnos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'cerrar',
          monto_declarado: parseFloat(montoDeclarado)
        }),
      });
      if (res.ok) {
        alert('Turno cerrado exitosamente.');
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const totalParcialMixto = (parseFloat(pagoEfectivo) || 0) + (parseFloat(pagoTarjeta) || 0) + (parseFloat(pagoTransferencia) || 0);

  return (
    <div className="flex h-screen bg-slate-100 font-sans antialiased overflow-hidden">
      {/* COLUMNA IZQUIERDA */}
      <div className="flex-1 flex flex-col p-4 border-r border-slate-200">
        {/* ENCABEZADO SUPERIOR CON TODOS LOS BOTONES */}
        <div className="flex justify-between items-center bg-white p-3 rounded-2xl shadow-sm border border-slate-200 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center font-black text-xs">PASE</div>
            <span className="font-bold text-slate-800 text-sm">PASE</span>
            <span className="text-slate-400">|</span>
            <span className="text-xs text-slate-600 flex items-center gap-1"><UserCheck size={14}/> Dueño (Administrador)</span>
            <span className="bg-purple-100 text-purple-700 font-black text-[10px] px-2 py-0.5 rounded-md">ADMIN</span>
            <span className="bg-slate-100 text-slate-600 font-bold text-[10px] px-1.5 py-0.5 rounded-md">#1</span>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setModalGasto(true)} className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg transition">
              <MinusCircle size={14}/> Gasto
            </button>
            <button onClick={handleAbrirCierre} className="flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg transition">
              $ Cajas
            </button>
            <button onClick={() => window.location.href = '/productos'} className="flex items-center gap-1 text-xs font-bold bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg transition">
              <Package size={14}/> Stock
            </button>
            <button onClick={() => alert('Generador de etiquetas')} className="flex items-center gap-1 text-xs font-bold bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg transition">
              <Barcode size={14}/> Etiquetas
            </button>
            <button onClick={() => alert('Gestión de personal y PINs')} className="flex items-center gap-1 text-xs font-bold bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg transition">
              <Key size={14}/> Personal
            </button>
            <button onClick={handleAbrirCierre} className="flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-lg transition">
              <LogOut size={14}/> Cerrar
            </button>
          </div>
        </div>

        {/* MENSAJE DE ÉXITO */}
        {mensajeExito && (
          <div className="bg-emerald-600 text-white font-bold text-sm px-4 py-3 rounded-xl mb-3 flex items-center gap-2 shadow-lg animate-fade-in">
            <CheckCircle size={18} /> {mensajeExito}
          </div>
        )}

        {/* INPUT DE BÚSQUEDA */}
        <form onSubmit={handleBuscar} className="mb-3">
          <div className="relative">
            <Search className="absolute left-4 top-3.5 text-blue-500" size={22} />
            <input
              ref={inputBusquedaRef}
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Pase lector o empiece a escribir el nombre..."
              className="w-full bg-white text-base font-medium pl-12 pr-4 py-3 rounded-2xl border-2 border-blue-500 focus:outline-none shadow-sm"
            />
          </div>
        </form>

        {/* LISTA DE ITEMS */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {items.map(item => (
            <div key={item.id} className="bg-white border-2 border-blue-100 p-4 rounded-2xl flex justify-between items-center shadow-sm">
              <div className="max-w-[70%]">
                <h3 className="font-extrabold text-slate-800 text-lg leading-tight">{item.nombre}</h3>
                <span className="text-sm font-semibold text-slate-500">${item.precio.toLocaleString()} x {item.cantidad} unidad(es)</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1">
                  <button onClick={() => modificarCantidad(item.id, -1)} className="p-1.5 bg-white rounded-lg hover:bg-slate-200"><Minus size={14}/></button>
                  <span className="font-black text-sm px-1">{item.cantidad}</span>
                  <button onClick={() => modificarCantidad(item.id, 1)} className="p-1.5 bg-white rounded-lg hover:bg-slate-200"><Plus size={14}/></button>
                </div>
                <span className="text-2xl font-black text-blue-600">${(item.precio * item.cantidad).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* COLUMNA DERECHA: TOTALES Y COBRO */}
      <div className="w-[380px] bg-white p-5 flex flex-col justify-between border-l border-slate-200">
        <div>
          <div className="bg-[#0f172a] text-white p-6 rounded-2xl mb-4 text-center">
            <span className="text-xs tracking-wider uppercase font-extrabold text-slate-400 block mb-1">TOTAL A COBRAR</span>
            <span className="text-5xl font-black text-[#10b981]">${total.toLocaleString()}</span>
          </div>

          <label className="text-sm font-bold text-slate-700 block mb-1">¿Con cuánto paga? (Efectivo)</label>
          <div className="relative mb-3">
            <input
              type="number"
              value={montoRecibido}
              onChange={(e) => setMontoRecibido(e.target.value)}
              placeholder="0"
              className="w-full text-2xl font-black p-3 rounded-xl border border-slate-300 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {recibidoNum > total && (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl mb-3 text-center">
              <span className="text-xs font-bold text-amber-700 block uppercase">Vuelto a entregar</span>
              <span className="text-2xl font-black text-amber-900">${vuelto.toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* ACCIONES DE COBRO */}
        <div className="space-y-2.5">
          <button
            onClick={() => procesarCobro('efectivo')}
            disabled={cargando || items.length === 0}
            className="w-full bg-[#10b981] hover:bg-[#059669] disabled:opacity-50 text-white font-black text-xl py-4 rounded-2xl flex items-center justify-center gap-2 transition"
          >
            <DollarSign size={24} /> COBRAR EFECTIVO
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => procesarCobro('tarjeta')}
              disabled={cargando || items.length === 0}
              className="bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 text-white font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-1.5 transition"
            >
              <CreditCard size={18} /> Tarjeta
            </button>
            <button
              onClick={() => procesarCobro('transferencia')}
              disabled={cargando || items.length === 0}
              className="bg-[#0ea5e9] hover:bg-[#0284c7] disabled:opacity-50 text-white font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-1.5 transition"
            >
              <Smartphone size={18} /> Transf. / QR
            </button>
          </div>

          <button
            onClick={() => setModalMixto(true)}
            disabled={cargando || items.length === 0}
            className="w-full bg-[#a855f7] hover:bg-[#9333ea] disabled:opacity-50 text-white font-bold text-base py-3.5 rounded-xl flex items-center justify-center gap-2 transition"
          >
            <Split size={20} /> Dividir / Pago Mixto
          </button>

          <button
            onClick={() => { setItems([]); setMontoRecibido(''); }}
            disabled={items.length === 0}
            className="w-full bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-600 font-bold text-sm py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition"
          >
            <Trash2 size={16} /> Cancelar / Nueva Venta
          </button>
        </div>
      </div>

      {/* MODAL PAGO MIXTO */}
      {modalMixto && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xl font-black text-slate-800">Dividir Pago</h2>
              <span className="text-sm font-black bg-purple-100 text-purple-700 px-2.5 py-1 rounded-lg">Total: ${total.toLocaleString()}</span>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">Efectivo ($)</label>
                <input
                  type="number"
                  value={pagoEfectivo}
                  onChange={(e) => setPagoEfectivo(e.target.value)}
                  placeholder="0"
                  className="w-full text-lg font-bold p-2.5 rounded-xl border border-slate-300 text-center focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">Tarjeta ($)</label>
                <input
                  type="number"
                  value={pagoTarjeta}
                  onChange={(e) => setPagoTarjeta(e.target.value)}
                  placeholder="0"
                  className="w-full text-lg font-bold p-2.5 rounded-xl border border-slate-300 text-center focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">Transferencia / QR ($)</label>
                <input
                  type="number"
                  value={pagoTransferencia}
                  onChange={(e) => setPagoTransferencia(e.target.value)}
                  placeholder="0"
                  className="w-full text-lg font-bold p-2.5 rounded-xl border border-slate-300 text-center focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border flex justify-between text-sm font-bold">
                <span>Total ingresado:</span>
                <span className={totalParcialMixto >= total ? 'text-emerald-600' : 'text-rose-500'}>
                  ${totalParcialMixto.toLocaleString()} de${total.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setModalMixto(false)} className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition">
                Volver
              </button>
              <button onClick={procesarCobroMixto} disabled={cargando || totalParcialMixto < total} className="w-2/3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-black py-3 rounded-xl transition">
                Confirmar Cobro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RETIRO / GASTO */}
      {modalGasto && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
            <h2 className="text-xl font-black text-slate-800 mb-2">Registrar Salida de Dinero</h2>
            <form onSubmit={handleRegistrarGasto} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Monto a retirar ($)</label>
                <input
                  type="number"
                  required
                  value={montoGasto}
                  onChange={(e) => setMontoGasto(e.target.value)}
                  placeholder="$ 0"
                  className="w-full text-xl font-black p-3 rounded-xl border border-slate-300 text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Motivo / Proveedor</label>
                <input
                  type="text"
                  required
                  value={motivoGasto}
                  onChange={(e) => setMotivoGasto(e.target.value)}
                  placeholder="Ej: Pago de panadería, hielo..."
                  className="w-full text-sm font-medium p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModalGasto(false)} className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl">Cancelar</button>
                <button type="submit" className="w-2/3 bg-amber-600 hover:bg-amber-700 text-white font-black py-3 rounded-xl">Guardar Retiro</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CIERRE DE CAJA */}
      {modalCierre && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl">
            <h2 className="text-2xl font-black text-slate-800 mb-1">Cierre de Turno</h2>
            <p className="text-xs text-slate-500 mb-4">Ingrese el efectivo real contado en la gaveta</p>

            <div className="mb-4">
              <label className="text-xs font-bold text-slate-700 block mb-1">Dinero en Mano ($)</label>
              <input
                type="number"
                value={montoDeclarado}
                onChange={(e) => setMontoDeclarado(e.target.value)}
                placeholder="$ 0"
                className="w-full text-3xl font-black p-3 rounded-xl border border-slate-300 text-center focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setModalCierre(false)} className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl">Volver</button>
              <button onClick={handleConfirmarCierre} className="w-2/3 bg-rose-600 hover:bg-rose-700 text-white font-black py-3 rounded-xl">Confirmar Cierre</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}