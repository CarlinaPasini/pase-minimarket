'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ShoppingCart, Trash2, CreditCard, DollarSign, Smartphone,
  Split, Search, UserCheck, LogOut,
  Package, Barcode, Key, Plus, Minus, CheckCircle, Printer, MinusCircle
} from 'lucide-react';

interface ItemVenta {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
}

export default function CajaPOS() {
  const [usuario, setUsuario] = useState<{ id: string; nombre: string; rol: string } | null>(null);
  const [turno, setTurno] = useState<{ id: number; monto_inicial: number } | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [modalApertura, setModalApertura] = useState(false);
  const [fondoInicial, setFondoInicial] = useState('');

  const [items, setItems] = useState<ItemVenta[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [sugerencias, setSugerencias] = useState<any[]>([]);
  const [montoRecibido, setMontoRecibido] = useState('');
  const [cargando, setCargando] = useState(false);

  // Estados para Retiro / Gasto
  const [modalGasto, setModalGasto] = useState(false);
  const [montoGasto, setMontoGasto] = useState('');
  const [motivoGasto, setMotivoGasto] = useState('');

  const [modalMixto, setModalMixto] = useState(false);
  const [pagoEfectivo, setPagoEfectivo] = useState('');
  const [pagoTarjeta, setPagoTarjeta] = useState('');
  const [pagoTransferencia, setPagoTransferencia] = useState('');

  const [ticketImprimir, setTicketImprimir] = useState<any>(null);

  const [modalCierre, setModalCierre] = useState(false);
  const [resumenCierre, setResumenCierre] = useState<any>(null);
  const [montoDeclarado, setMontoDeclarado] = useState('');

  const inputBusquedaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (usuario && turno && !modalMixto && !modalCierre && !ticketImprimir && !modalGasto) {
      inputBusquedaRef.current?.focus();
    }
  }, [items, usuario, turno, modalMixto, modalCierre, ticketImprimir, modalGasto]);

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

  // ATAJOS DE TECLADO (F12, Ctrl+Q, Ctrl+W, Ctrl+E, Ctrl+R, Ctrl+M)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!usuario || !turno || modalCierre || ticketImprimir || modalGasto) return;

      if (e.key === 'F12') {
        e.preventDefault();
        if (items.length > 0 && !cargando && !modalMixto) {
          procesarCobro('efectivo');
        }
      } else if (e.ctrlKey && (e.key === 'q' || e.key === 'Q')) {
        e.preventDefault();
        if (items.length > 0 && !cargando && !modalMixto) {
          procesarCobro('transferencia');
        }
      } else if (e.ctrlKey && (e.key === 'w' || e.key === 'W')) {
        e.preventDefault();
        if (items.length > 0 && !cargando && !modalMixto) {
          procesarCobro('transferencia');
        }
      } else if (e.ctrlKey && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        if (items.length > 0 && !cargando && !modalMixto) {
          procesarCobro('tarjeta');
        }
      } else if (e.ctrlKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        if (items.length > 0 && !cargando && !modalMixto) {
          procesarCobro('tarjeta');
        }
      } else if (e.ctrlKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        if (items.length > 0 && !cargando && !modalMixto) {
          setModalMixto(true);
          setPagoEfectivo('');
          setPagoTarjeta('');
          setPagoTransferencia('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, cargando, turno, usuario, modalMixto, modalCierre, ticketImprimir, modalGasto, montoRecibido]);

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

  const handleRegistrarGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!montoGasto || !motivoGasto.trim() || !turno || !usuario) return;

    try {
      const res = await fetch('/api/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turno_id: turno.id,
          usuario_id: usuario.id,
          tipo: 'gasto',
          monto: parseFloat(montoGasto),
          motivo: motivoGasto,
        }),
      });

      if (res.ok) {
        alert('Retiro / Gasto registrado correctamente.');
        setModalGasto(false);
        setMontoGasto('');
        setMotivoGasto('');
      } else {
        alert('Error al registrar la salida de dinero');
      }
    } catch {
      alert('Error de conexión');
    }
  };

  const total = items.reduce((acc, item) => acc + (Number(item.precio) || 0) * item.cantidad, 0);
  const recibidoNum = parseFloat(montoRecibido) || 0;
  const vuelto = recibidoNum > total ? recibidoNum - total : 0;

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

  const procesarCobroMixto = async () => {
    if (sumaMixta !== total) {
      if (sumaMixta > total) {
        alert(`Te pasaste del monto: Ingresaste $${sumaMixta.toLocaleString()} y el total es de $${total.toLocaleString()}.`);
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

  if (!usuario || !turno) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        {modalApertura ? (
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl text-center">
            <div className="w-14 h-14 rounded-full overflow-hidden bg-black mx-auto mb-3 border border-slate-200 shadow-sm flex items-center justify-center">
              <img src="/logo.jpeg" alt="PASE" className="w-full h-full object-cover" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-1">
              {usuario?.rol === 'admin' ? 'Panel de Administración' : 'Apertura de Caja'}
            </h2>
            <p className="text-xs text-slate-500 mb-5">
              Bienvenido, <strong className="text-slate-800">{usuario?.nombre}</strong>
            </p>

            {usuario?.rol === 'admin' && (
              <div className="mb-5 pb-5 border-b border-slate-100">
                <Link
                  href="/reportes"
                  className="w-full bg-[#0f172a] hover:bg-black text-white font-black py-3.5 px-4 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg transition"
                >
                  <DollarSign size={18} className="text-emerald-400" />
                  Monitorear en Vivo (Sin Abrir Caja)
                </Link>
              </div>
            )}

            <form onSubmit={handleAbrirCaja} className="space-y-3">
              <label className="text-xs font-bold text-slate-600 block text-left">
                {usuario?.rol === 'admin' ? 'O inicia un turno para cobrar en mostrador:' : 'Fondo inicial de cambio ($):'}
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
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl text-center">
            <div className="w-14 h-14 rounded-full overflow-hidden bg-black mx-auto mb-3 border border-slate-200 shadow-sm flex items-center justify-center">
              <img src="/logo.jpeg" alt="PASE" className="w-full h-full object-cover" />
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

  return (
    <div className="flex flex-col lg:flex-row min-h-screen lg:h-screen w-full bg-slate-100 font-sans antialiased overflow-y-auto lg:overflow-hidden p-2 sm:p-3 gap-3">
      {/* SECCIÓN IZQUIERDA */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 mb-2.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-black flex-shrink-0 border border-slate-200 shadow-sm flex items-center justify-center">
                <img src="/logo.jpeg" alt="PASE" className="w-full h-full object-cover" />
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

            {/* BOTÓN DE RETIRO / GASTO */}
            <button
              onClick={() => setModalGasto(true)}
              className="bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition border border-amber-200"
              title="Registrar pago a proveedor o salida de caja"
            >
              <MinusCircle size={15} /> Retiro / Gasto
            </button>
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
              className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 sm:py-2 rounded-xl transition ml-auto"
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
            className="w-full bg-[#52b788] hover:bg-[#40916c] disabled:opacity-50 text-white font-black text-lg sm:text-xl py-3.5 sm:py-4 rounded-2xl flex items-center justify-between px-5 transition shadow-sm"
          >
            <span className="flex items-center gap-2"><DollarSign size={22} /> COBRAR EFECTIVO</span>
            <span className="text-xs font-mono bg-black/20 px-2 py-1 rounded">F12</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => procesarCobro('tarjeta')}
              disabled={cargando || items.length === 0}
              className="bg-[#818cf8] hover:bg-[#6366f1] disabled:opacity-50 text-white font-bold text-xs py-2.5 sm:py-3 rounded-xl flex flex-col items-center justify-center transition"
            >
              <div className="flex items-center gap-1"><CreditCard size={15} /> Tarjeta</div>
              <span className="text-[10px] font-mono opacity-80 mt-0.5">Ctrl+E / Ctrl+R</span>
            </button>
            <button
              onClick={() => procesarCobro('transferencia')}
              disabled={cargando || items.length === 0}
              className="bg-[#38bdf8] hover:bg-[#0ea5e9] disabled:opacity-50 text-white font-bold text-xs py-2.5 sm:py-3 rounded-xl flex flex-col items-center justify-center transition"
            >
              <div className="flex items-center gap-1"><Smartphone size={15} /> Transferencia / QR</div>
              <span className="text-[10px] font-mono opacity-80 mt-0.5">Ctrl+Q / Ctrl+W</span>
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
            className="w-full bg-[#c084fc] hover:bg-[#a855f7] disabled:opacity-50 text-white font-bold text-sm sm:text-base py-3 rounded-xl flex items-center justify-between px-5 transition"
          >
            <span className="flex items-center gap-2"><Split size={18} /> Dividir / Pago Mixto</span>
            <span className="text-xs font-mono bg-black/20 px-2 py-1 rounded">Ctrl+M</span>
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
                  autoFocus
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

      {/* MODAL CIERRE DE TURNO */}
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

            {resumenCierre && (
              <div className="bg-slate-50 p-3 rounded-2xl border text-xs space-y-2 mb-4 font-semibold text-slate-600">
                <div className="flex justify-between text-slate-700">
                  <span>Fondo de cambio:</span>
                  <span className="font-bold text-slate-900">
                    ${parseFloat(resumenCierre.turno.monto_inicial).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-blue-700 font-bold border-t pt-1.5">
                  <span>Recaudación a rendir:</span>
                  <span className="font-black text-sm">
                    ${Math.max(0, (parseFloat(montoDeclarado) || 0) - parseFloat(resumenCierre.turno.monto_inicial)).toLocaleString()}
                  </span>
                </div>
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