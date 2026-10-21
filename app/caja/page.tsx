'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ShoppingCart, Trash2, CreditCard, DollarSign, Smartphone,
  Split, Search, UserCheck, LogOut,
  Package, Barcode, Key, Plus, Minus, CheckCircle, Printer
} from 'lucide-react';

interface ItemVenta {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
}

export default function CajaPOS() {
  // Autenticación y Turno
  const [usuario, setUsuario] = useState<{ id: string; nombre: string; rol: string } | null>(null);
  const [turno, setTurno] = useState<{ id: number; monto_inicial: number } | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [modalApertura, setModalApertura] = useState(false);
  const [fondoInicial, setFondoInicial] = useState('');

  // Carrito de ventas
  const [items, setItems] = useState<ItemVenta[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [sugerencias, setSugerencias] = useState<any[]>([]);
  const [montoRecibido, setMontoRecibido] = useState('');
  const [cargando, setCargando] = useState(false);

  // Pago Mixto
  const [modalMixto, setModalMixto] = useState(false);
  const [pagoEfectivo, setPagoEfectivo] = useState('');
  const [pagoTarjeta, setPagoTarjeta] = useState('');
  const [pagoTransferencia, setPagoTransferencia] = useState('');

  // Ticket Térmico
  const [ticketImprimir, setTicketImprimir] = useState<any>(null);

  // Cierre y Arqueo Discriminado
  const [modalCierre, setModalCierre] = useState(false);
  const [resumenCierre, setResumenCierre] = useState<any>(null);
  const [montoDeclarado, setMontoDeclarado] = useState('');

  const inputBusquedaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (usuario && turno && !modalMixto && !modalCierre && !ticketImprimir) {
      inputBusquedaRef.current?.focus();
    }
  }, [items, usuario, turno, modalMixto, modalCierre, ticketImprimir]);

  // Autocompletado en vivo
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

  // LOGIN POR PIN
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) return;
    setLoginError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setLoginError(data.error || 'PIN incorrecto');
        setPinInput('');
        return;
      }

      setUsuario(data.user);
      if (data.turno) {
        setTurno(data.turno);
      } else {
        setModalApertura(true);
      }
      setPinInput('');
    } catch {
      setLoginError('Error de conexión al autenticar');
    }
  };

  // APERTURA DE TURNO CON FONDO
  const handleAbrirCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario) return;

    try {
      const res = await fetch('/api/turnos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'abrir',
          usuario_id: usuario.id,
          monto_inicial: parseFloat(fondoInicial) || 0,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTurno(data.turno);
        setModalApertura(false);
        setFondoInicial('');
      } else {
        alert(data.error || 'Error al abrir caja');
      }
    } catch {
      alert('Error al conectar con el servidor');
    }
  };

  const total = items.reduce((acc, item) => acc + (Number(item.precio) || 0) * item.cantidad, 0);
  const recibidoNum = parseFloat(montoRecibido) || 0;
  const vuelto = recibidoNum > total ? recibidoNum - total : 0;

  // Montos de Pago Mixto
  const efNum = parseFloat(pagoEfectivo) || 0;
  const tjNum = parseFloat(pagoTarjeta) || 0;
  const trNum = parseFloat(pagoTransferencia) || 0;
  const sumaMixta = efNum + tjNum + trNum;
  const diferenciaMixta = total - sumaMixta;

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
    } catch {
      alert('Error al consultar producto');
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

  // COBRAR VENTA SIMPLE
  const procesarCobro = async (metodo: string) => {
    if (items.length === 0 || cargando || !turno || !usuario) return;
    setCargando(true);

    const cobroRecibido = metodo === 'efectivo' && recibidoNum > 0 ? recibidoNum : total;
    const vueltoEntrega = metodo === 'efectivo' ? vuelto : 0;

    try {
      const res = await fetch('/api/ventas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          metodo_pago: metodo,
          monto_recibido: cobroRecibido,
          total,
          vuelto: vueltoEntrega,
          turno_id: turno.id,
          usuario_id: usuario.id,
          pagos: [{ metodo, monto: total }]
        }),
      });

      if (res.ok) {
        setTicketImprimir({
          items: [...items],
          total,
          metodo_pago: metodo.toUpperCase(),
          recibido: cobroRecibido,
          vuelto: vueltoEntrega,
          fecha: new Date(),
          turnoId: turno.id,
          cajero: usuario.nombre
        });
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

  // COBRAR PAGO MIXTO VALIDADO EXACTO
  const procesarCobroMixto = async () => {
    if (sumaMixta !== total) {
      if (sumaMixta > total) {
        alert(`Te pasaste del monto: Ingresaste $${sumaMixta.toLocaleString()} y el total es de $${total.toLocaleString()}. Ajusta los valores para que dé exacto.`);
      } else {
        alert(`Falta cubrir dinero: Ingresaste $${sumaMixta.toLocaleString()} y faltan $${diferenciaMixta.toLocaleString()}.`);
      }
      return;
    }

    if (!turno || !usuario) return;
    setCargando(true);

    try {
      const pagos = [
        { metodo: 'efectivo', monto: efNum },
        { metodo: 'tarjeta', monto: tjNum },
        { metodo: 'transferencia', monto: trNum }
      ].filter(p => p.monto > 0);

      const res = await fetch('/api/ventas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          metodo_pago: 'mixto',
          total,
          pagos,
          monto_recibido: total,
          vuelto: 0,
          turno_id: turno.id,
          usuario_id: usuario.id
        }),
      });

      if (res.ok) {
        setTicketImprimir({
          items: [...items],
          total,
          metodo_pago: 'PAGO MIXTO',
          recibido: total,
          vuelto: 0,
          fecha: new Date(),
          turnoId: turno.id,
          cajero: usuario.nombre
        });
        setItems([]);
        setModalMixto(false);
        setPagoEfectivo('');
        setPagoTarjeta('');
        setPagoTransferencia('');
      } else {
        alert('Error al registrar pago mixto');
      }
    } catch {
      alert('Error de conexión');
    } finally {
      setCargando(false);
    }
  };

  // ABRIR ARQUEO DE CIERRE
  const abrirCierreTurno = async () => {
    if (!turno) return;
    try {
      const res = await fetch(`/api/turnos?turno_id=${turno.id}`);
      if (res.ok) {
        const data = await res.json();
        setResumenCierre(data);
        setModalCierre(true);
      }
    } catch {
      setModalCierre(true);
    }
  };

  // CONFIRMAR CIERRE
  const handleConfirmarCierre = async () => {
    if (!turno) return;
    try {
      const res = await fetch('/api/turnos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'cerrar',
          turno_id: turno.id,
          monto_declarado: parseFloat(montoDeclarado) || 0,
        }),
      });

      if (res.ok) {
        alert('Turno cerrado y auditado con éxito.');
        setUsuario(null);
        setTurno(null);
        setModalCierre(false);
        setMontoDeclarado('');
        setItems([]);
      }
    } catch {
      alert('Error al cerrar turno');
    }
  };

  // PANTALLA 1: LOGIN POR PIN O MODAL DE APERTURA / SUPERVISIÓN
  if (!usuario || !turno) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        {/* MODAL APERTURA DE TURNO O MODO MONITOREO */}
        {modalApertura ? (
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl text-center">
            <h2 className="text-2xl font-black text-slate-800 mb-1">
              {usuario?.rol === 'admin' ? 'Panel de Administración' : 'Apertura de Caja'}
            </h2>
            <p className="text-xs text-slate-500 mb-5">
              Bienvenido, <strong className="text-slate-800">{usuario?.nombre}</strong>
            </p>

            {/* ACCESO EXCLUSIVO DE DUEÑO: MONITOREAR SIN ABRIR CAJA */}
            {usuario?.rol === 'admin' && (
              <div className="mb-5 pb-5 border-b border-slate-100">
                <Link
                  href="/reportes"
                  className="w-full bg-[#0f172a] hover:bg-black text-white font-black py-3.5 px-4 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg transition"
                >
                  <DollarSign size={18} className="text-emerald-400" />
                  Monitorear en Vivo (Sin Abrir Caja)
                </Link>
                <p className="text-[11px] text-slate-400 mt-2">
                  Ver ventas del día, arqueos y cajas activas de tus empleados.
                </p>
              </div>
            )}

            {/* FORMULARIO DE APERTURA CON FONDO */}
            <form onSubmit={handleAbrirCaja} className="space-y-3">
              <label className="text-xs font-bold text-slate-600 block text-left">
                {usuario?.rol === 'admin' 
                  ? 'O inicia un turno para cobrar en mostrador:' 
                  : 'Fondo inicial de cambio ($):'}
              </label>
              <input
                type="number"
                required
                value={fondoInicial}
                onChange={(e) => setFondoInicial(e.target.value)}
                placeholder="$ 0"
                className="w-full text-2xl font-black p-3 rounded-2xl border-2 border-slate-300 text-center mb-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                className="w-full bg-[#10b981] hover:bg-[#059669] text-white font-black py-3.5 rounded-2xl text-sm shadow transition"
              >
                Abrir Caja y Comenzar a Cobrar
              </button>

              {/* BOTÓN SALIR AL TECLADO DE PINS (BIEN UBICADO DENTRO DEL FORMULARIO) */}
              <button
                type="button"
                onClick={() => {
                  setUsuario(null);
                  setModalApertura(false);
                  setPinInput('');
                }}
                className="w-full mt-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-xl text-xs transition"
              >
                Cambiar de Usuario / Salir al PIN
              </button>
            </form>
          </div>
        ) : (
          /* LOGIN POR PIN RÁPIDO */
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl text-center">
            <div className="w-14 h-14 bg-black text-white font-black text-base rounded-full flex items-center justify-center mx-auto mb-3 shadow">
              PASE
            </div>
            <h1 className="text-2xl font-black text-slate-800 mb-1">Iniciar Sesión</h1>
            <p className="text-xs text-slate-400 mb-5">Ingrese su PIN de 4 dígitos</p>

            {loginError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold p-2.5 rounded-xl mb-4">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="password"
                maxLength={4}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="••••"
                autoFocus
                className="w-full text-4xl tracking-widest font-black text-center p-3.5 rounded-2xl border-2 border-slate-300 focus:outline-none focus:border-blue-500 bg-slate-50"
              />

              <div className="grid grid-cols-3 gap-2 pt-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'OK'].map((btn) => (
                  <button
                    key={btn}
                    type="button"
                    onClick={() => {
                      if (btn === 'C') setPinInput('');
                      else if (btn === 'OK') handleLogin({ preventDefault: () => {} } as any);
                      else if (pinInput.length < 4) setPinInput(prev => prev + btn);
                    }}
                    className="p-3.5 text-xl font-bold bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 rounded-xl transition"
                  >
                    {btn}
                  </button>
                ))}
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // PANTALLA 2: CAJA RESPONSIVE CON ACCESOS SEGÚN ROL
  return (
    <div className="flex flex-col lg:flex-row min-h-screen lg:h-screen w-full bg-slate-100 font-sans antialiased overflow-y-auto lg:overflow-hidden p-2 sm:p-3 gap-3">
      {/* SECCIÓN IZQUIERDA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* BARRA SUPERIOR CON CONTROLES */}
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 mb-2.5 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-black text-xs tracking-tighter">
              PASE
            </div>
            <span className="font-extrabold text-slate-900 text-sm sm:text-base">PASE</span>
            <span className="text-slate-300">|</span>
            <span className="text-xs sm:text-sm text-slate-700 font-semibold flex items-center gap-1">
              <UserCheck size={15} className="text-blue-600" /> {usuario.nombre}
            </span>
            <span className="bg-purple-100 text-purple-700 font-black text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md uppercase">
              {usuario.rol}
            </span>
            <span className="bg-slate-100 text-slate-600 font-bold text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md">
              Turno #{turno.id}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {usuario.rol === 'admin' && (
              <Link
                href="/usuarios"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-xl transition shadow-sm"
              >
                <Key size={14} className="text-slate-500" /> Personal y PINs
              </Link>
            )}

            {(usuario.rol === 'admin' || usuario.rol === 'encargado') && (
              <>
                <Link
                  href="/reportes"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 sm:py-2 rounded-xl transition"
                >
                  <DollarSign size={14} /> Control de Cajas
                </Link>
                <Link
                  href="/productos"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 sm:py-2 rounded-xl transition shadow-sm"
                >
                  <Package size={14} className="text-slate-500" /> Inventario
                </Link>
                <Link
                  href="/etiquetas"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 sm:py-2 rounded-xl transition shadow-sm"
                >
                  <Barcode size={14} className="text-slate-500" /> Etiquetas
                </Link>
              </>
            )}

            <button
              onClick={abrirCierreTurno}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 sm:py-2 rounded-xl transition"
            >
              <LogOut size={14} /> Cerrar Turno / Arqueo
            </button>
          </div>
        </div>

        {/* BUSCADOR */}
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

        {/* LISTA DE ITEMS */}
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

      {/* SECCIÓN DERECHA */}
      <div className="w-full lg:w-[330px] xl:w-[360px] flex-shrink-0 bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between shadow-sm">
        <div>
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
            onClick={() => {
              setModalMixto(true);
              setPagoEfectivo('');
              setPagoTarjeta('');
              setPagoTransferencia('');
            }}
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

      {/* MODAL PAGO MIXTO CON VALIDACIÓN EXACTA */}
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

              <div className="p-3 rounded-xl border text-xs font-bold space-y-1 bg-slate-50">
                <div className="flex justify-between">
                  <span>Asignado:</span>
                  <span className={sumaMixta === total ? 'text-emerald-600 font-black' : 'text-slate-800'}>
                    ${sumaMixta.toLocaleString()} de${total.toLocaleString()}
                  </span>
                </div>
                {sumaMixta < total && (
                  <p className="text-amber-600 font-bold">Faltan: ${diferenciaMixta.toLocaleString()}</p>
                )}
                {sumaMixta > total && (
                  <p className="text-rose-600 font-black">Te pasaste por: ${(sumaMixta - total).toLocaleString()}</p>
                )}
                {sumaMixta === total && (
                  <p className="text-emerald-600 font-black">✓ Monto exacto cubierto</p>
                )}
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
                disabled={cargando || sumaMixta !== total}
                className="w-2/3 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-bold py-2 rounded-lg text-sm transition"
              >
                Confirmar Cobro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TICKET POSVENTA */}
      {ticketImprimir && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 shadow-2xl w-full max-w-xs text-center animate-fade-in">
            <div className="flex justify-center mb-2">
              <CheckCircle className="text-emerald-500" size={48} />
            </div>
            <h3 className="text-xl font-black text-slate-800">¡Venta Registrada!</h3>
            <p className="text-sm font-bold text-slate-500 mb-4">Total: ${ticketImprimir.total.toLocaleString()}</p>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  window.print();
                  setTicketImprimir(null);
                }}
                className="w-full bg-slate-900 hover:bg-black text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 text-sm shadow transition"
              >
                <Printer size={18} /> Imprimir Ticket
              </button>
              <button
                onClick={() => setTicketImprimir(null)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition"
              >
                Continuar sin Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PLANTILLA DE IMPRESIÓN PARA TICKET TÉRMICO */}
      {ticketImprimir && (
        <div id="ticket-impresion" className="hidden print:block font-mono text-[11px] leading-tight text-black p-2 w-[58mm] max-w-[80mm] mx-auto">
          <div className="text-center mb-2">
            <p className="font-bold text-sm tracking-tighter">PASE MINIMARKET</p>
            <p className="text-[9px]">Av. San Martín 2321, Mendoza</p>
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
              <span>Medio:</span>
              <span>{ticketImprimir.metodo_pago}</span>
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

      {/* MODAL CIERRE DE TURNO Y ARQUEO DISCRIMINADO */}
      {modalCierre && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
            <h2 className="text-xl font-black text-slate-800 mb-1">Cierre de Caja y Arqueo</h2>
            <p className="text-xs text-slate-500 mb-3">Turno #{turno.id} — {usuario.nombre}</p>

            <label className="text-xs font-bold text-slate-700 block mb-1">
              Dinero total contado en gaveta ($):
            </label>
            <input
              type="number"
              value={montoDeclarado}
              onChange={(e) => setMontoDeclarado(e.target.value)}
              placeholder="$ 0"
              autoFocus
              className="w-full text-2xl font-black p-3 rounded-xl border border-slate-300 text-center mb-3 focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />

            {/* DISCRIMINACIÓN AUTOMÁTICA DEL FONDO Y LA RECAUDACIÓN */}
            {resumenCierre && (
              <div className="bg-slate-50 p-3 rounded-2xl border text-xs space-y-2 mb-4 font-semibold text-slate-600">
                <div className="flex justify-between text-slate-700">
                  <span>Fondo de cambio (a dejar en caja):</span>
                  <span className="font-bold text-slate-900">
                    ${parseFloat(resumenCierre.turno.monto_inicial).toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between text-blue-700 font-bold border-t pt-1.5">
                  <span>Recaudación a rendir / entregar:</span>
                  <span className="font-black text-sm">
                    ${Math.max(0, (parseFloat(montoDeclarado) || 0) - parseFloat(resumenCierre.turno.monto_inicial)).toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between text-emerald-700 pt-1">
                  <span>Ventas en Efectivo del turno:</span>
                  <span className="font-bold">${parseFloat(resumenCierre.totales.total_efectivo).toLocaleString()}</span>
                </div>

                {/* COMPARACIÓN DE DIFERENCIA */}
                {parseFloat(montoDeclarado) > 0 && (
                  <div className="border-t pt-1.5 flex justify-between text-xs font-black">
                    <span>Resultado arqueo:</span>
                    {(() => {
                      const fondo = parseFloat(resumenCierre.turno.monto_inicial) || 0;
                      const aRendir = (parseFloat(montoDeclarado) || 0) - fondo;
                      const ventasEsperadas = (parseFloat(resumenCierre.totales.total_efectivo) || 0) - (parseFloat(resumenCierre.totalEgresos) || 0);
                      const dif = aRendir - ventasEsperadas;

                      if (dif === 0) return <span className="text-emerald-600">✓ Caja exacta ($0)</span>;
                      if (dif > 0) return <span className="text-blue-600">Sobra: +${dif.toLocaleString()}</span>;
                      return <span className="text-rose-600">Falta: -${Math.abs(dif).toLocaleString()}</span>;
                    })()}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setModalCierre(false)}
                className="w-1/3 bg-slate-100 text-slate-700 font-bold py-2.5 rounded-xl text-sm"
              >
                Volver
              </button>
              <button
                onClick={handleConfirmarCierre}
                disabled={!montoDeclarado}
                className="w-2/3 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-black py-2.5 rounded-xl text-sm shadow transition"
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