'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ShoppingCart, Trash2, CreditCard, DollarSign, Smartphone,
  Split, Search, UserCheck, LogOut,
  Package, Barcode, Key, Plus, Minus
} from 'lucide-react';

interface ItemVenta {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
}

export default function CajaPOS() {
  const [items, setItems] = useState<ItemVenta[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [sugerencias, setSugerencias] = useState<any[]>([]);
  const [montoRecibido, setMontoRecibido] = useState('');
  const [cargando, setCargando] = useState(false);

  // Modales
  const [modalMixto, setModalMixto] = useState(false);
  const [pagoEfectivo, setPagoEfectivo] = useState('');
  const [pagoTarjeta, setPagoTarjeta] = useState('');
  const [pagoTransferencia, setPagoTransferencia] = useState('');

  const [modalCierre, setModalCierre] = useState(false);
  const [montoDeclarado, setMontoDeclarado] = useState('');
  const [modalPersonal, setModalPersonal] = useState(false);

  const inputBusquedaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputBusquedaRef.current?.focus();
  }, [items]);

  // Autocompletado mientras escribes (mínimo 2 letras)
  useEffect(() => {
    const texto = busqueda.trim();
    if (texto.length >= 2) {
      const delay = setTimeout(async () => {
        try {
          const res = await fetch(`/api/productos?codigo=${encodeURIComponent(texto)}&autocomplete=true`);
          if (res.ok) {
            const data = await res.json();
            setSugerencias(Array.isArray(data) ? data : []);
          }
        } catch {
          setSugerencias([]);
        }
      }, 150);
      return () => clearTimeout(delay);
    } else {
      setSugerencias([]);
    }
  }, [busqueda]);

  const total = items.reduce((acc, item) => acc + (Number(item.precio) || 0) * item.cantidad, 0);
  const recibidoNum = parseFloat(montoRecibido) || 0;
  const vuelto = recibidoNum > total ? recibidoNum - total : 0;

  const agregarProducto = (prod: any) => {
    const precio = parseFloat(String(prod.precio_venta || prod.precio || 0));
    setItems(prev => {
      const existe = prev.find(p => p.id === prod.id);
      if (existe) {
        return prev.map(p => p.id === prod.id ? { ...p, cantidad: p.cantidad + 1 } : p);
      }
      return [...prev, { id: prod.id, nombre: prod.nombre, precio, cantidad: 1 }];
    });
    setBusqueda('');
    setSugerencias([]);
  };

  const handleBuscar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!busqueda.trim()) return;

    try {
      const res = await fetch(`/api/productos?codigo=${encodeURIComponent(busqueda.trim())}`);
      if (res.ok) {
        const prod = await res.json();
        const item = Array.isArray(prod) ? prod[0] : prod;
        if (item && item.id) {
          agregarProducto(item);
        } else {
          alert('Producto no encontrado');
        }
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
      } else {
        alert('Error al registrar la venta');
      }
    } catch {
      alert('Error de conexión');
    } finally {
      setCargando(false);
    }
  };

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
      } else {
        alert('Error al registrar el cobro mixto');
      }
    } catch {
      alert('Error de conexión');
    } finally {
      setCargando(false);
    }
  };

  const totalParcialMixto = (parseFloat(pagoEfectivo) || 0) + (parseFloat(pagoTarjeta) || 0) + (parseFloat(pagoTransferencia) || 0);

  return (
    <div className="flex flex-col lg:flex-row min-h-screen lg:h-screen w-full bg-slate-100 font-sans antialiased overflow-y-auto lg:overflow-hidden p-2 sm:p-3 gap-3">
      {/* SECCIÓN IZQUIERDA: CABECERA, BUSCADOR Y LISTA DE COMPRA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ENCABEZADO SUPERIOR */}
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 mb-2.5 space-y-2.5">
          {/* Fila 1: Datos del local y usuario */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-black text-xs tracking-tighter">
              PASE
            </div>
            <span className="font-extrabold text-slate-900 text-sm sm:text-base">PASE</span>
            <span className="text-slate-300">|</span>
            <span className="text-xs sm:text-sm text-slate-700 font-semibold flex items-center gap-1">
              <UserCheck size={15} className="text-blue-600" /> Dueño (Administrador)
            </span>
            <span className="bg-purple-100 text-purple-700 font-black text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md">
              ADMIN
            </span>
            <span className="bg-slate-100 text-slate-600 font-bold text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md">
              Turno #2
            </span>
          </div>

          {/* Fila 2: Botón Personal y PINs */}
          <div>
            <button
              onClick={() => setModalPersonal(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-xl transition shadow-sm"
            >
              <Key size={14} className="text-slate-500" /> Personal y PINs
            </button>
          </div>

          {/* Fila 3: Botones de acciones */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => alert('Control y Arqueo de Cajas')}
              className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 sm:py-2 rounded-xl transition"
            >
              $ Control de Cajas
            </button>
            <Link
              href="/productos"
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 sm:py-2 rounded-xl transition shadow-sm"
            >
              <Package size={14} className="text-slate-500" /> Inventario
            </Link>
            <Link
              href="/etiquetas"
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 sm:py-2 rounded-xl transition shadow-sm"
            >
              <Barcode size={14} className="text-slate-500" /> Etiquetas
            </Link>
            <button
              onClick={() => setModalCierre(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 sm:py-2 rounded-xl transition"
            >
              <LogOut size={14} /> Cerrar Turno / Arqueo
            </button>
          </div>
        </div>

        {/* INPUT DE BÚSQUEDA */}
        <div className="relative mb-2.5">
          <form onSubmit={handleBuscar}>
            <Search className="absolute left-3.5 top-3 text-blue-500" size={20} />
            <input
              ref={inputBusquedaRef}
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Pase lector o empiece a escribir el nombre..."
              className="w-full bg-white text-sm sm:text-base font-medium pl-11 pr-4 py-2.5 sm:py-3 rounded-2xl border-2 border-blue-500 focus:outline-none shadow-sm"
            />
          </form>

          {/* DESPLEGABLE EN VIVO */}
          {sugerencias.length > 0 && (
            <div className="absolute left-0 right-0 top-14 bg-white border border-slate-200 rounded-2xl shadow-2xl z-40 max-h-56 overflow-y-auto">
              {sugerencias.map((s) => (
                <div
                  key={s.id}
                  onClick={() => agregarProducto(s)}
                  className="p-2.5 sm:p-3 hover:bg-blue-50 cursor-pointer flex justify-between items-center border-b border-slate-100 last:border-0"
                >
                  <div>
                    <p className="font-bold text-sm text-slate-800">{s.nombre}</p>
                    <span className="text-xs text-slate-400 font-mono">{s.codigo_barras}</span>
                  </div>
                  <span className="font-black text-blue-600 text-sm sm:text-base">
                    ${parseFloat(String(s.precio_venta)).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CONTENEDOR DE PRODUCTOS */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 overflow-y-auto min-h-[220px]">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 sm:gap-3 py-10 lg:py-0">
              <ShoppingCart size={54} className="stroke-1 text-slate-300" />
              <p className="text-base sm:text-lg font-bold text-slate-400 text-center">
                Pase un código de barras o escriba un nombre
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map(item => (
                <div key={item.id} className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex justify-between items-center">
                  <div className="max-w-[60%] sm:max-w-[65%]">
                    <h3 className="font-extrabold text-slate-800 text-sm sm:text-base leading-tight">{item.nombre}</h3>
                    <span className="text-xs font-semibold text-slate-500">${item.precio.toLocaleString()} x {item.cantidad} un.</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
                      <button onClick={() => modificarCantidad(item.id, -1)} className="p-1 hover:bg-slate-100 rounded"><Minus size={12}/></button>
                      <span className="font-black text-xs px-1">{item.cantidad}</span>
                      <button onClick={() => modificarCantidad(item.id, 1)} className="p-1 hover:bg-slate-100 rounded"><Plus size={12}/></button>
                    </div>
                    <span className="text-base sm:text-xl font-black text-blue-600 w-20 sm:w-24 text-right">
                      ${(item.precio * item.cantidad).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SECCIÓN DERECHA: TOTAL Y BOTONERA (RESPONSIVE EN MÓVILES) */}
      <div className="w-full lg:w-[330px] xl:w-[360px] flex-shrink-0 bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between shadow-sm">
        <div>
          {/* TOTAL A COBRAR */}
          <div className="bg-[#0f172a] text-white p-4 sm:p-5 rounded-2xl mb-3 text-center">
            <span className="text-[11px] tracking-wider uppercase font-extrabold text-slate-400 block mb-1">
              TOTAL A COBRAR
            </span>
            <span className="text-4xl sm:text-5xl font-black text-[#10b981]">
              ${total.toLocaleString()}
            </span>
          </div>

          <label className="text-xs sm:text-sm font-bold text-slate-700 block mb-1">
            ¿Con cuánto paga? (Efectivo)
          </label>
          <div className="bg-slate-50 border border-slate-300 rounded-2xl p-2.5 sm:p-3 mb-2.5">
            <input
              type="number"
              value={montoRecibido}
              onChange={(e) => setMontoRecibido(e.target.value)}
              placeholder="$ 0"
              className="w-full text-2xl sm:text-3xl font-black bg-transparent text-center text-slate-800 focus:outline-none"
            />
          </div>

          {recibidoNum > total && (
            <div className="bg-amber-50 border border-amber-200 p-2 rounded-xl mb-2.5 text-center">
              <span className="text-xs font-bold text-amber-700 block uppercase">Vuelto a entregar</span>
              <span className="text-xl sm:text-2xl font-black text-amber-900">${vuelto.toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* ACCIONES DE COBRO */}
        <div className="space-y-2">
          <button
            onClick={() => procesarCobro('efectivo')}
            disabled={cargando || items.length === 0}
            className="w-full bg-[#52b788] hover:bg-[#40916c] disabled:opacity-50 text-white font-black text-lg sm:text-xl py-3.5 sm:py-4 rounded-2xl flex items-center justify-center gap-2 transition shadow-sm"
          >
            <DollarSign size={22} /> COBRAR EFECTIVO
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => procesarCobro('tarjeta')}
              disabled={cargando || items.length === 0}
              className="bg-[#818cf8] hover:bg-[#6366f1] disabled:opacity-50 text-white font-bold text-xs py-2.5 sm:py-3 rounded-xl flex items-center justify-center gap-1.5 transition"
            >
              <CreditCard size={15} /> Tarjeta
            </button>
            <button
              onClick={() => procesarCobro('transferencia')}
              disabled={cargando || items.length === 0}
              className="bg-[#38bdf8] hover:bg-[#0ea5e9] disabled:opacity-50 text-white font-bold text-xs py-2.5 sm:py-3 rounded-xl flex items-center justify-center gap-1.5 transition"
            >
              <Smartphone size={15} /> Transferencia / QR
            </button>
          </div>

          <button
            onClick={() => setModalMixto(true)}
            disabled={cargando || items.length === 0}
            className="w-full bg-[#c084fc] hover:bg-[#a855f7] disabled:opacity-50 text-white font-bold text-sm sm:text-base py-3 rounded-xl flex items-center justify-center gap-2 transition"
          >
            <Split size={18} /> Dividir / Pago Mixto
          </button>

          <button
            onClick={() => { setItems([]); setMontoRecibido(''); }}
            disabled={items.length === 0}
            className="w-full bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-600 font-bold text-xs py-2 sm:py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition"
          >
            <Trash2 size={15} /> Cancelar / Nueva Venta
          </button>
        </div>
      </div>

      {/* MODAL PAGO MIXTO */}
      {modalMixto && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-black text-slate-800">Dividir Pago</h2>
              <span className="text-xs font-black bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                Total: ${total.toLocaleString()}
              </span>
            </div>

            <div className="space-y-2 mb-4">
              <div>
                <label className="text-xs font-bold text-slate-600 mb-0.5 block">Efectivo ($)</label>
                <input
                  type="number"
                  value={pagoEfectivo}
                  onChange={(e) => setPagoEfectivo(e.target.value)}
                  placeholder="0"
                  className="w-full text-base font-bold p-2 rounded-lg border border-slate-300 text-center focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-0.5 block">Tarjeta ($)</label>
                <input
                  type="number"
                  value={pagoTarjeta}
                  onChange={(e) => setPagoTarjeta(e.target.value)}
                  placeholder="0"
                  className="w-full text-base font-bold p-2 rounded-lg border border-slate-300 text-center focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-0.5 block">Transferencia / QR ($)</label>
                <input
                  type="number"
                  value={pagoTransferencia}
                  onChange={(e) => setPagoTransferencia(e.target.value)}
                  placeholder="0"
                  className="w-full text-base font-bold p-2 rounded-lg border border-slate-300 text-center focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border flex justify-between text-xs font-bold">
                <span>Total ingresado:</span>
                <span className={totalParcialMixto >= total ? 'text-emerald-600' : 'text-rose-500'}>
                  ${totalParcialMixto.toLocaleString()} de${total.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setModalMixto(false)}
                className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-lg text-sm"
              >
                Volver
              </button>
              <button
                onClick={procesarCobroMixto}
                disabled={cargando || totalParcialMixto < total}
                className="w-2/3 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-bold py-2 rounded-lg text-sm"
              >
                Confirmar Cobro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PERSONAL Y PINS */}
      {modalPersonal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl">
            <h2 className="text-lg font-black text-slate-800 mb-2">Personal y PINs</h2>
            <div className="space-y-2 text-sm text-slate-600 mb-4">
              <div className="p-2 bg-slate-50 rounded-lg flex justify-between">
                <span>Dueño (Admin):</span>
                <span className="font-mono font-bold">1111</span>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg flex justify-between">
                <span>Encargado:</span>
                <span className="font-mono font-bold">2222</span>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg flex justify-between">
                <span>Cajera:</span>
                <span className="font-mono font-bold">3333</span>
              </div>
            </div>
            <button
              onClick={() => setModalPersonal(false)}
              className="w-full bg-slate-800 text-white font-bold py-2 rounded-xl text-sm"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* MODAL CIERRE DE TURNO */}
      {modalCierre && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl">
            <h2 className="text-lg font-black text-slate-800 mb-1">Cierre de Caja y Arqueo</h2>
            <p className="text-xs text-slate-500 mb-3">Dinero real contado en la gaveta</p>
            <input
              type="number"
              value={montoDeclarado}
              onChange={(e) => setMontoDeclarado(e.target.value)}
              placeholder="$ 0"
              className="w-full text-2xl font-black p-2.5 rounded-lg border border-slate-300 text-center mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setModalCierre(false)}
                className="w-1/3 bg-slate-100 text-slate-700 font-bold py-2 rounded-lg text-sm"
              >
                Volver
              </button>
              <button
                onClick={() => { alert('Caja cerrada con éxito'); window.location.reload(); }}
                className="w-2/3 bg-rose-600 text-white font-bold py-2 rounded-lg text-sm"
              >
                Confirmar Cierre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}