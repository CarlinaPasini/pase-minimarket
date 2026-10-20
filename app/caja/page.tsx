'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  ShoppingCart, Trash2, CreditCard, DollarSign, Smartphone,
  AlertCircle, CheckCircle, Split, Search, UserCheck, LogOut,
  Package, Barcode, Key, Printer, MinusCircle
} from 'lucide-react';

interface ItemVenta {
  id: string;
  nombre: string;
  codigo_barras: string;
  precio: number;
  cantidad: number;
}

interface ProductoSugerido {
  id: string;
  nombre: string;
  codigo_barras: string;
  precio_venta: string | number;
  stock: number;
}

export default function PantallaCaja() {
  // Sesión y Turno
  const [usuario, setUsuario] = useState<{ id: string; nombre: string; rol: string } | null>(null);
  const [turno, setTurno] = useState<{ id: number; monto_inicial: number } | null>(null);

  // Modales
  const [pinInput, setPinInput] = useState('');
  const [modalApertura, setModalApertura] = useState(false);
  const [montoInicialInput, setMontoInicialInput] = useState('');
  const [modalCierre, setModalCierre] = useState(false);
  const [resumenCierre, setResumenCierre] = useState<any>(null);
  const [montoDeclarado, setMontoDeclarado] = useState('');

  // Retiros y Gastos de Caja Chica
  const [modalGasto, setModalGasto] = useState(false);
  const [montoGasto, setMontoGasto] = useState('');
  const [motivoGasto, setMotivoGasto] = useState('');

  // Ticket Térmico
  const [ticketImprimir, setTicketImprimir] = useState<any>(null);

  // Venta en curso
  const [items, setItems] = useState<ItemVenta[]>([]);
  const [codigoInput, setCodigoInput] = useState('');
  const [montoRecibido, setMontoRecibido] = useState<string>('');
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [ventaExitosa, setVentaExitosa] = useState(false);
  const [cargando, setCargando] = useState(false);

  // Autocompletado en vivo
  const [sugerencias, setSugerencias] = useState<ProductoSugerido[]>([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);

  // Pago Mixto
  const [modalMixto, setModalMixto] = useState(false);
  const [pagoEfectivo, setPagoEfectivo] = useState<string>('');
  const [pagoTarjeta, setPagoTarjeta] = useState<string>('');
  const [pagoTransferencia, setPagoTransferencia] = useState<string>('');

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (usuario && turno && !modalMixto && !modalCierre && !modalGasto && !ticketImprimir) {
      inputRef.current?.focus();
    }
  }, [items, mensajeError, ventaExitosa, modalMixto, usuario, turno, modalCierre, modalGasto, ticketImprimir]);

  useEffect(() => {
    const texto = codigoInput.trim();
    if (texto.length < 2) {
      setSugerencias([]);
      setMostrarSugerencias(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/productos?codigo=${encodeURIComponent(texto)}&autocomplete=true`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setSugerencias(data);
            setMostrarSugerencias(true);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [codigoInput]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensajeError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'PIN incorrecto');

      setUsuario(data.user);
      if (data.turno) {
        setTurno(data.turno);
      } else {
        setModalApertura(true);
      }
      setPinInput('');
    } catch (err: any) {
      setMensajeError(err.message);
    }
  };

  const handleAbrirCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/turnos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'abrir',
          usuario_id: usuario?.id,
          monto_inicial: parseFloat(montoInicialInput) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTurno(data.turno);
      setModalApertura(false);
      setMontoInicialInput('');
    } catch (err: any) {
      setMensajeError(err.message);
    }
  };

  const abrirModalCierre = async () => {
    if (!turno) return;
    try {
      const res = await fetch(`/api/turnos?turno_id=${turno.id}`);
      const data = await res.json();
      if (res.ok) {
        setResumenCierre(data);
        setModalCierre(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCerrarCaja = async () => {
    try {
      const res = await fetch('/api/turnos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'cerrar',
          turno_id: turno?.id,
          monto_declarado: parseFloat(montoDeclarado) || 0,
        }),
      });
      if (res.ok) {
        setTurno(null);
        setUsuario(null);
        setModalCierre(false);
        setItems([]);
        alert('Turno cerrado correctamente.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRegistrarGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!montoGasto || !motivoGasto.trim()) return;

    try {
      const res = await fetch('/api/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turno_id: turno?.id,
          usuario_id: usuario?.id,
          tipo: 'gasto',
          monto: parseFloat(montoGasto),
          motivo: motivoGasto,
        }),
      });

      if (res.ok) {
        alert('Retiro registrado en el turno.');
        setModalGasto(false);
        setMontoGasto('');
        setMotivoGasto('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const agregarProductoAlTicket = (prod: any) => {
    setMensajeError(null);
    setVentaExitosa(false);

    setItems((prev) => {
      const existe = prev.find((item) => item.id === prod.id);
      if (existe) {
        return prev.map((item) =>
          item.id === prod.id ? { ...item, cantidad: item.cantidad + 1 } : item
        );
      }
      return [
        ...prev,
        {
          id: prod.id,
          nombre: prod.nombre,
          codigo_barras: prod.codigo_barras,
          precio: parseFloat(String(prod.precio_venta)),
          cantidad: 1,
        },
      ];
    });

    setCodigoInput('');
    setSugerencias([]);
    setMostrarSugerencias(false);
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const codigo = codigoInput.trim();
    if (!codigo) return;

    if (sugerencias.length > 0) {
      agregarProductoAlTicket(sugerencias[0]);
      return;
    }

    try {
      const res = await fetch(`/api/productos?codigo=${encodeURIComponent(codigo)}`);
      if (!res.ok) {
        setMensajeError(`Producto o código "${codigo}" no encontrado.`);
        setCodigoInput('');
        return;
      }
      const prod = await res.json();
      agregarProductoAlTicket(prod);
    } catch (err) {
      setMensajeError('Error de conexión con el servidor.');
    }
  };

  const total = items.reduce((acc, curr) => acc + curr.precio * curr.cantidad, 0);
  const recibidoNum = parseFloat(montoRecibido) || 0;
  const vuelto = recibidoNum > total ? recibidoNum - total : 0;

  const efNum = parseFloat(pagoEfectivo) || 0;
  const tjNum = parseFloat(pagoTarjeta) || 0;
  const trNum = parseFloat(pagoTransferencia) || 0;

  const procesarCobro = async (metodo: string, desglose?: { metodo: string; monto: number }[]) => {
    if (items.length === 0) return;
    setCargando(true);
    setMensajeError(null);

    try {
      const res = await fetch('/api/ventas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          metodo_pago: metodo,
          monto_recibido: metodo === 'efectivo' && recibidoNum > 0 ? recibidoNum : total,
          total,
          vuelto: metodo === 'efectivo' ? vuelto : 0,
          pagos: desglose || [{ metodo, monto: total }],
          turno_id: turno?.id,
          usuario_id: usuario?.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al procesar la venta');
      }

      // Preparar datos para imprimir el comprobante térmico
      setTicketImprimir({
        items: [...items],
        total,
        metodo_pago: metodo,
        recibido: metodo === 'efectivo' && recibidoNum > 0 ? recibidoNum : total,
        vuelto: metodo === 'efectivo' ? vuelto : 0,
        fecha: new Date(),
        cajero: usuario?.nombre,
        turnoId: turno?.id,
      });

      setVentaExitosa(true);
      setItems([]);
      setMontoRecibido('');
      setModalMixto(false);
      setTimeout(() => setVentaExitosa(false), 3000);
    } catch (err: any) {
      setMensajeError(err.message);
    } finally {
      setCargando(false);
    }
  };

  // 1. PANTALLA DE LOGIN CON PIN
  if (!usuario) {
    return (
      <div className="flex h-screen bg-slate-900 items-center justify-center font-sans p-4">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm text-center">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden shadow-md border-2 border-slate-100 flex items-center justify-center bg-black">
            <img 
              src="/logo.jpeg" 
              alt="PASE Minimarket" 
              className="w-full h-full object-cover"
            />
          </div>

          <h1 className="text-2xl font-black text-slate-800 tracking-tight">PASE MINIMARKET</h1>
          <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-6">Punto de Venta</p>

          {mensajeError && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-xl text-sm font-bold flex items-center gap-2">
              <AlertCircle size={18} /> {mensajeError}
            </div>
          )}

          <input
            type="password"
            maxLength={6}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="PIN"
            className="w-full text-center text-4xl tracking-widest font-black p-4 rounded-2xl border-2 border-slate-300 focus:outline-none focus:border-slate-900 mb-6 bg-slate-50"
            autoFocus
          />

          <button
            type="submit"
            className="w-full bg-black hover:bg-slate-800 text-white font-black py-4 rounded-2xl text-lg shadow-lg transition active:scale-95 tracking-wide"
          >
            INGRESAR
          </button>
        </form>
      </div>
    );
  }

  // 2. MODAL DE APERTURA DE TURNO
  if (modalApertura || !turno) {
    return (
      <div className="flex h-screen bg-slate-900 items-center justify-center font-sans p-4">
        <form onSubmit={handleAbrirCaja} className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md">
          <h2 className="text-2xl font-black text-slate-800 mb-2">Apertura de Turno</h2>
          <p className="text-sm text-slate-500 mb-6">
            Bienvenido/a <b>{usuario.nombre}</b>. Ingrese el dinero inicial disponible para dar vuelto:
          </p>

          <label className="text-xs uppercase font-bold text-slate-400 block mb-1">Fondo de Caja ($)</label>
          <input
            type="number"
            value={montoInicialInput}
            onChange={(e) => setMontoInicialInput(e.target.value)}
            placeholder="$ 5000"
            className="w-full text-3xl font-black p-4 rounded-2xl border-2 border-slate-300 focus:outline-none focus:border-emerald-500 mb-6 text-center bg-slate-50"
            autoFocus
          />

          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl text-xl shadow-lg transition"
          >
            ABRIR TURNO Y EMPEZAR
          </button>
        </form>
      </div>
    );
  }

  // 3. PANTALLA PRINCIPAL
  return (
    <div className="flex h-screen bg-slate-100 font-sans select-none relative">
      <div className="w-2/3 flex flex-col p-4 border-r border-slate-300">
        
        {/* BARRA SUPERIOR ALINEADA EN UNA SOLA LÍNEA */}
        <div className="flex items-center justify-between gap-2 mb-3 bg-white px-3 py-2 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-black flex-shrink-0 border border-slate-200 shadow-sm flex items-center justify-center">
              <img src="/logo.jpeg" alt="PASE" className="w-full h-full object-cover" />
            </div>

            <span className="font-black text-slate-900 tracking-tight text-sm">PASE</span>
            <span className="text-slate-300">|</span>

            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <UserCheck className="text-blue-600" size={15} />
              <span className="max-w-[120px] truncate">{usuario.nombre}</span>
            </div>

            <span className={`text-[10px] px-2 py-0.5 rounded-md font-black uppercase tracking-wider ${
              usuario.rol === 'admin' ? 'bg-purple-100 text-purple-700' :
              usuario.rol === 'encargado' ? 'bg-blue-100 text-blue-700' : 
              'bg-emerald-100 text-emerald-700'
            }`}>
              {usuario.rol}
            </span>

            <span className="text-[11px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded border border-slate-200">
              #{turno.id}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <button
              onClick={() => setModalGasto(true)}
              className="bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition border border-amber-200"
              title="Registrar pago a proveedor o salida de dinero"
            >
              <MinusCircle size={14} /> Gasto
            </button>

            {(usuario.rol === 'admin' || usuario.rol === 'encargado') && (
              <>
                <Link
                  href="/reportes"
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition border border-indigo-200"
                  title="Control de Cajas"
                >
                  <DollarSign size={14} /> Cajas
                </Link>
                <Link
                  href="/productos"
                  className="bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition border border-slate-200"
                  title="Inventario y Stock"
                >
                  <Package size={14} /> Stock
                </Link>
                <Link
                  href="/etiquetas"
                  className="bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition border border-slate-200"
                  title="Etiquetas de Código de Barras"
                >
                  <Barcode size={14} /> Etiquetas
                </Link>
              </>
            )}

            {usuario.rol === 'admin' && (
              <Link
                href="/usuarios"
                className="bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition border border-slate-200"
                title="Administrar Empleados y PINs"
              >
                <Key size={14} /> Personal
              </Link>
            )}

            <button
              onClick={abrirModalCierre}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-black px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition border border-rose-200"
              title="Cerrar Turno y Arqueo"
            >
              <LogOut size={14} /> Cerrar
            </button>
          </div>
        </div>

        {/* INPUT DE ESCANEO / BÚSQUEDA */}
        <div className="relative mb-3">
          <form onSubmit={handleScan}>
            <div className="relative flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={codigoInput}
                onChange={(e) => setCodigoInput(e.target.value)}
                onBlur={() => setTimeout(() => setMostrarSugerencias(false), 250)}
                onFocus={() => sugerencias.length > 0 && setMostrarSugerencias(true)}
                placeholder="Pase lector o empiece a escribir el nombre..."
                className="w-full text-xl font-bold p-4 pl-12 rounded-xl border-4 border-blue-500 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-300 bg-white"
              />
              <Search className="absolute left-4 text-slate-400" size={24} />
            </div>
          </form>

          {mostrarSugerencias && sugerencias.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {sugerencias.map((prod) => (
                <div
                  key={prod.id}
                  onClick={() => agregarProductoAlTicket(prod)}
                  className="p-3.5 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition"
                >
                  <div>
                    <p className="font-bold text-lg text-slate-800">{prod.nombre}</p>
                    <p className="text-xs font-mono text-slate-400">Cód: {prod.codigo_barras} | Stock: {prod.stock}</p>
                  </div>
                  <div className="text-xl font-black text-blue-600">
                    ${parseFloat(String(prod.precio_venta)).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {mensajeError && (
          <div className="mb-3 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center gap-2 font-bold text-lg">
            <AlertCircle size={24} /> <span>{mensajeError}</span>
          </div>
        )}

        {ventaExitosa && (
          <div className="mb-3 p-4 bg-emerald-100 border border-emerald-400 text-emerald-800 rounded-xl flex items-center gap-3 font-extrabold text-xl shadow-sm">
            <CheckCircle size={28} /> <span>¡VENTA REGISTRADA CON ÉXITO! Stock actualizado.</span>
          </div>
        )}

        {/* LISTADO DE ITEMS VENDIDOS */}
        <div className="flex-1 overflow-y-auto bg-white rounded-xl shadow p-3 space-y-2">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <ShoppingCart size={64} />
              <p className="text-2xl font-bold mt-2">Pase un código de barras o escriba un nombre</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex justify-between items-center bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex-1">
                  <p className="font-bold text-2xl text-slate-800">{item.nombre}</p>
                  <p className="text-slate-500 font-bold text-lg">${item.precio.toLocaleString()} x {item.cantidad} unidad(es)</p>
                </div>
                <div className="text-3xl font-black text-blue-700 w-36 text-right">${(item.precio * item.cantidad).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* PANEL LATERAL DE COBRO */}
      <div className="w-1/3 flex flex-col justify-between p-6 bg-white shadow-lg">
        <div>
          <div className="bg-slate-900 text-white p-6 rounded-2xl mb-4 shadow">
            <span className="text-slate-300 text-lg uppercase font-bold tracking-wide">Total a Cobrar</span>
            <p className="text-6xl font-black mt-2 text-green-400">${total.toLocaleString()}</p>
          </div>

          <label className="text-slate-700 font-bold text-xl mb-1 block">¿Con cuánto paga? (Efectivo)</label>
          <input
            type="number"
            value={montoRecibido}
            onChange={(e) => setMontoRecibido(e.target.value)}
            placeholder="$ 0"
            className="w-full text-4xl font-extrabold p-4 rounded-xl border-2 border-slate-300 mb-4 bg-slate-50 focus:bg-white text-center"
          />

          {recibidoNum > 0 && (
            <div className="bg-amber-100 border border-amber-300 p-4 rounded-xl mb-4">
              <span className="text-amber-800 font-bold block text-sm uppercase">Vuelto a entregar</span>
              <p className="text-4xl font-black text-amber-900">${vuelto.toLocaleString()}</p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <button
            onClick={() => procesarCobro('efectivo')}
            disabled={cargando || items.length === 0}
            className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-black text-2xl py-4 rounded-2xl flex items-center justify-center gap-3 shadow transition"
          >
            <DollarSign size={30} /> {cargando ? 'REGISTRANDO...' : 'COBRAR EFECTIVO'}
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => procesarCobro('tarjeta')}
              disabled={cargando || items.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-base py-3 rounded-xl flex items-center justify-center gap-2"
            >
              <CreditCard size={20} /> Tarjeta
            </button>
            <button
              onClick={() => procesarCobro('transferencia')}
              disabled={cargando || items.length === 0}
              className="bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-bold text-base py-3 rounded-xl flex items-center justify-center gap-2"
            >
              <Smartphone size={20} /> Transferencia / QR
            </button>
          </div>

          <button
            onClick={() => setModalMixto(true)}
            disabled={cargando || items.length === 0}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-lg py-3 rounded-xl flex items-center justify-center gap-2 transition"
          >
            <Split size={22} /> Dividir / Pago Mixto
          </button>

          <button
            onClick={() => { setItems([]); setMontoRecibido(''); }}
            className="w-full bg-slate-200 hover:bg-rose-100 hover:text-rose-700 text-slate-700 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition"
          >
            <Trash2 size={18} /> Cancelar / Nueva Venta
          </button>
        </div>
      </div>

      {/* MODAL RETIRO / GASTO DE CAJA CHICA */}
      {modalGasto && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleRegistrarGasto} className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
            <h2 className="text-xl font-black text-slate-800 mb-1">Retiro / Salida de Caja</h2>
            <p className="text-xs text-slate-500 mb-4">Se descontará del efectivo esperado al cerrar el turno</p>

            <label className="text-xs uppercase font-bold text-slate-400 block mb-1">Monto Retirado ($)</label>
            <input
              type="number"
              value={montoGasto}
              onChange={(e) => setMontoGasto(e.target.value)}
              placeholder="$ 0"
              className="w-full text-2xl font-black p-3 rounded-xl border border-slate-300 text-center mb-3 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
              autoFocus
              required
            />

            <label className="text-xs uppercase font-bold text-slate-400 block mb-1">Motivo / Proveedor</label>
            <input
              type="text"
              value={motivoGasto}
              onChange={(e) => setMotivoGasto(e.target.value)}
              placeholder="Ej: Pago panadería / Hielo"
              className="w-full p-2.5 rounded-xl border border-slate-300 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-amber-500"
              required
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModalGasto(false)}
                className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="w-2/3 bg-amber-600 hover:bg-amber-700 text-white font-black py-2.5 rounded-xl text-sm shadow transition"
              >
                Confirmar Salida
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL / COMPROBANTE CON BOTÓN IMPRIMIR TICKET */}
      {ticketImprimir && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 shadow-2xl w-full max-w-xs text-center">
            <div className="flex justify-center mb-2">
              <CheckCircle className="text-emerald-500" size={44} />
            </div>
            <h3 className="text-xl font-black text-slate-800">¡Cobro Registrado!</h3>
            <p className="text-sm font-bold text-emerald-600 mb-5">Total: ${ticketImprimir.total.toLocaleString()}</p>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => window.print()}
                className="w-full bg-slate-900 hover:bg-black text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 text-sm shadow transition"
              >
                <Printer size={18} /> Imprimir Ticket
              </button>
              <button
                onClick={() => setTicketImprimir(null)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition"
              >
                Nueva Venta (Sin Imprimir)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ARQUEO DE CIERRE */}
      {modalCierre && resumenCierre && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl">
            <h2 className="text-2xl font-black text-slate-800 mb-1">Cierre de Caja y Arqueo</h2>
            <p className="text-sm text-slate-500 mb-4">Resumen acumulado del turno en curso</p>

            <div className="space-y-2 mb-6 bg-slate-50 p-4 rounded-2xl border text-sm">
              <div className="flex justify-between py-1"><span>Fondo Inicial:</span><span className="font-black">${parseFloat(resumenCierre.turno.monto_inicial).toLocaleString()}</span></div>
              <div className="flex justify-between py-1 text-emerald-700 font-bold"><span>Ventas Efectivo:</span><span>${parseFloat(resumenCierre.totales.total_efectivo).toLocaleString()}</span></div>
              <div className="flex justify-between py-1 text-indigo-700 font-bold"><span>Ventas Tarjeta:</span><span>${parseFloat(resumenCierre.totales.total_tarjeta).toLocaleString()}</span></div>
              <div className="flex justify-between py-1 text-sky-700 font-bold"><span>Ventas Transferencia/QR:</span><span>${parseFloat(resumenCierre.totales.total_transferencia).toLocaleString()}</span></div>
              
              {parseFloat(resumenCierre.totalEgresos || 0) > 0 && (
                <div className="flex justify-between py-1 text-amber-700 font-bold">
                  <span>(-) Retiros / Salidas de Caja:</span>
                  <span>-${parseFloat(resumenCierre.totalEgresos).toLocaleString()}</span>
                </div>
              )}

              <div className="border-t pt-2 flex justify-between font-black text-base text-slate-900">
                <span>Efectivo Esperado en Gaveta:</span>
                <span className="text-emerald-600">${resumenCierre.efectivoEsperado.toLocaleString()}</span>
              </div>
            </div>

            <div className="mb-6">
              <label className="text-sm font-bold text-slate-700 block mb-1">Dinero contado en mano (Efectivo real en caja):</label>
              <input
                type="number"
                value={montoDeclarado}
                onChange={(e) => setMontoDeclarado(e.target.value)}
                placeholder="$ 0"
                className="w-full text-2xl font-black p-3 rounded-xl border border-slate-300 text-center focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModalCierre(false)} className="w-1/3 bg-slate-200 hover:bg-slate-300 font-bold py-3 rounded-xl">Cancelar</button>
              <button onClick={handleCerrarCaja} className="w-2/3 bg-rose-600 hover:bg-rose-700 text-white font-black py-3 rounded-xl">Confirmar Cierre de Turno</button>
            </div>
          </div>
        </div>
      )}

      {/* PLANTILLA DE IMPRESIÓN PARA TICKET TÉRMICO (58mm / 80mm) */}
      {ticketImprimir && (
        <div id="ticket-impresion" className="hidden print:block font-mono text-[11px] leading-tight text-black p-2 w-[58mm] max-w-[80mm] mx-auto">
          <div className="text-center mb-2">
            <p className="font-bold text-sm tracking-tighter">PASE MINIMARKET</p>
            <p className="text-[9px]">Av. San Martín 2321, Mendoza</p>
            <p className="text-[9px]">CUIT: 30-99914233-4</p>
            <p className="text-[9px]">--------------------------------</p>
          </div>

          <div className="mb-2 text-[10px]">
            <p>Fecha: {new Date(ticketImprimir.fecha).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
            <p>Ticket Turno #{ticketImprimir.turnoId} | Cajero: {ticketImprimir.cajero}</p>
            <p>--------------------------------</p>
          </div>

          <table className="w-full text-left mb-2 text-[10px]">
            <thead>
              <tr className="border-b border-black">
                <th>Cant</th>
                <th>Detalle</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {ticketImprimir.items.map((it: any, i: number) => (
                <tr key={i}>
                  <td className="align-top">{it.cantidad}x</td>
                  <td>{it.nombre}</td>
                  <td className="text-right align-top">${(it.precio * it.cantidad).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-black pt-1 mb-2 text-[11px]">
            <div className="flex justify-between font-bold text-sm">
              <span>TOTAL:</span>
              <span>${ticketImprimir.total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span>Pago ({ticketImprimir.metodo_pago}):</span>
              <span>${ticketImprimir.recibido.toLocaleString()}</span>
            </div>
            {ticketImprimir.vuelto > 0 && (
              <div className="flex justify-between text-[10px] font-bold">
                <span>Vuelto:</span>
                <span>${ticketImprimir.vuelto.toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="text-center text-[9px] mt-3">
            <p>¡Gracias por su compra!</p>
            <p>PASE Minimarket</p>
          </div>
        </div>
      )}

    </div>
  );
}