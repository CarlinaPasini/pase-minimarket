'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, UserPlus, Users, Edit3, Trash2, Key, CheckCircle, AlertCircle, RefreshCw, Shield, Lock } from 'lucide-react';

interface Usuario {
  id: string;
  nombre: string;
  usuario: string;
  pin_cajero: string;
  rol: 'admin' | 'encargado' | 'cajero';
  activo: boolean;
}

export default function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  // Estados del Formulario
  const [idEditando, setIdEditando] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [usuarioLogin, setUsuarioLogin] = useState('');
  const [pin, setPin] = useState('');
  const [rol, setRol] = useState<'admin' | 'encargado' | 'cajero'>('cajero');

  const cargarUsuarios = async () => {
    setCargando(true);
    try {
      const res = await fetch('/api/usuarios');
      if (res.ok) {
        const data = await res.json();
        setUsuarios(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const seleccionarParaEditar = (u: Usuario) => {
    setIdEditando(u.id);
    setNombre(u.nombre);
    setUsuarioLogin(u.usuario);
    setPin(u.pin_cajero);
    setRol(u.rol);
    setMensaje(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarEdicion = () => {
    setIdEditando(null);
    setNombre('');
    setUsuarioLogin('');
    setPin('');
    setRol('cajero');
    setMensaje(null);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje(null);

    if (!nombre.trim() || !pin.trim()) {
      setMensaje({ tipo: 'error', texto: 'El nombre y el PIN de 4 dígitos son obligatorios.' });
      return;
    }

    if (pin.length < 4) {
      setMensaje({ tipo: 'error', texto: 'El PIN debe tener al menos 4 números.' });
      return;
    }

    try {
      const metodo = idEditando ? 'PUT' : 'POST';
      const body = idEditando
        ? { id: idEditando, nombre, pin, rol, activo: true }
        : { nombre, usuario: usuarioLogin || nombre.toLowerCase().replace(/\s+/g, ''), pin, rol };

      const res = await fetch('/api/usuarios', {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar');

      setMensaje({
        tipo: 'ok',
        texto: idEditando ? '¡Datos y PIN actualizados con éxito!' : '¡Nuevo empleado registrado con éxito!',
      });
      cancelarEdicion();
      cargarUsuarios();
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message });
    }
  };

  const handleEliminar = async (u: Usuario) => {
    if (!confirm(`¿Dar de baja a "${u.nombre}"? Ya no podrá acceder con su PIN.`)) return;

    try {
      const res = await fetch(`/api/usuarios?id=${u.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMensaje({ tipo: 'ok', texto: `"${u.nombre}" ha sido dado de baja.` });
      cargarUsuarios();
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message });
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans p-6">
      {/* Encabezado con Logo PASE */}
      <div className="max-w-6xl mx-auto flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm mb-6 border border-slate-200">
        <div className="flex items-center gap-3">
          <Link href="/caja" className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 transition">
            <ArrowLeft size={20} />
          </Link>

          <div className="w-10 h-10 rounded-full overflow-hidden bg-black flex-shrink-0 border border-slate-200 shadow-sm flex items-center justify-center">
            <img src="/logo.jpeg" alt="PASE" className="w-full h-full object-cover" />
          </div>

          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">PASE MINIMARKET — Personal y PINs</h1>
            <p className="text-xs text-slate-400">Control de acceso, roles y contraseñas de cajeros</p>
          </div>
        </div>

        <button
          onClick={cargarUsuarios}
          className="p-2.5 bg-black hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition"
        >
          <RefreshCw size={15} className={cargando ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario de Empleado / PIN */}
        <div className="bg-white p-6 rounded-2xl shadow-sm lg:col-span-1 h-fit sticky top-6 border border-slate-200">
          <h2 className="text-xl font-black text-slate-800 mb-1 flex items-center gap-2">
            <UserPlus className="text-blue-600" />
            {idEditando ? 'Modificar Empleado' : 'Nuevo Empleado'}
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            {idEditando ? 'Cambia el nombre, rol o PIN del empleado.' : 'Ingresa el nombre y el PIN de 4 dígitos para ingresar a la caja.'}
          </p>

          {mensaje && (
            <div className={`p-3 rounded-xl mb-4 text-xs font-bold flex items-center gap-2 ${
              mensaje.tipo === 'ok' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {mensaje.tipo === 'ok' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              {mensaje.texto}
            </div>
          )}

          <form onSubmit={handleGuardar} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Nombre Completo</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Laura Gómez"
                className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {!idEditando && (
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Usuario Interno</label>
                <input
                  type="text"
                  value={usuarioLogin}
                  onChange={(e) => setUsuarioLogin(e.target.value)}
                  placeholder="Ej: laura"
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                PIN de Acceso a Caja <span className="text-slate-400 font-normal">(4 a 6 dígitos)</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type="password"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Ej: 3333"
                  className="w-full p-3 pl-10 rounded-xl border-2 border-slate-300 text-2xl font-black tracking-widest text-center focus:outline-none focus:border-blue-500 bg-slate-50"
                />
                <Key className="absolute left-3 text-slate-400" size={18} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Rol / Permisos</label>
              <select
                value={rol}
                onChange={(e: any) => setRol(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="cajero">Cajero (Solo cobra y arquea su turno)</option>
                <option value="encargado">Encargado (Caja, inventario, precios y etiquetas)</option>
                <option value="admin">Dueño / Admin (Acceso total)</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              {idEditando && (
                <button
                  type="button"
                  onClick={cancelarEdicion}
                  className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition text-sm"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                className={`w-full font-black py-3 rounded-xl transition shadow active:scale-95 text-sm ${
                  idEditando ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-black hover:bg-slate-800 text-white'
                }`}
              >
                {idEditando ? 'Guardar Cambios' : 'Registrar Empleado'}
              </button>
            </div>
          </form>
        </div>

        {/* Tabla de Empleados */}
        <div className="bg-white p-6 rounded-2xl shadow-sm lg:col-span-2 flex flex-col border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Users className="text-slate-600" /> Lista de Empleados Registrados ({usuarios.length})
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-xs bg-slate-50">
                  <th className="py-3 px-3">Empleado</th>
                  <th className="py-3 px-3">Rol</th>
                  <th className="py-3 px-3 text-center">PIN Actual</th>
                  <th className="py-3 px-3 text-center">Estado</th>
                  <th className="py-3 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usuarios.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-800">{u.nombre}</p>
                      <span className="text-xs font-mono text-slate-400">@{u.usuario}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider ${
                        u.rol === 'admin' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                        u.rol === 'encargado' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 
                        'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}>
                        {u.rol}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-black text-base text-slate-700">
                      {u.pin_cajero}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded font-black uppercase ${
                        u.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex justify-center gap-1.5">
                        <button
                          onClick={() => seleccionarParaEditar(u)}
                          className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl transition"
                          title="Cambiar PIN o modificar datos"
                        >
                          <Edit3 size={16} />
                        </button>
                        {u.rol !== 'admin' && (
                          <button
                            onClick={() => handleEliminar(u)}
                            className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl transition"
                            title="Dar de baja empleado"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}