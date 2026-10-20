'use client';

import { useState, useRef, useEffect } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer, RefreshCw, Barcode } from 'lucide-react';

export default function GeneradorEtiquetas() {
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [codigoGenerado, setCodigoGenerado] = useState('');
  const barcodeRef = useRef<SVGSVGElement>(null);

  const calcularEAN13 = (correlativo: number) => {
    const cuerpo = '20' + String(correlativo).padStart(10, '0');
    let suma = 0;
    for (let i = 0; i < 12; i++) {
      const d = parseInt(cuerpo[i], 10);
      suma += (i % 2 === 0) ? d : d * 3;
    }
    const residuo = suma % 10;
    const verificador = residuo === 0 ? 0 : 10 - residuo;
    return `${cuerpo}${verificador}`;
  };

  const generarNuevoCodigo = () => {
    const num = Math.floor(100000 + Math.random() * 900000);
    setCodigoGenerado(calcularEAN13(num));
  };

  useEffect(() => {
    generarNuevoCodigo();
  }, []);

  useEffect(() => {
    if (codigoGenerado && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, codigoGenerado, {
          format: 'EAN13',
          lineColor: '#000',
          width: 2,
          height: 50,
          displayValue: true,
          fontSize: 14,
        });
      } catch (err) {
        console.error(err);
      }
    }
  }, [codigoGenerado]);

  return (
    <div className="min-h-screen bg-slate-100 p-8 font-sans">
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow p-6">
        <div className="flex items-center gap-3 border-b pb-4 mb-6">
          <Barcode size={32} className="text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Generar Etiquetas de Precios</h1>
            <p className="text-sm text-slate-500">Para productos a granel, panadería o fraccionados</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Nombre del Producto</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Pan Francés x Kg"
              className="w-full text-lg p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Precio ($)</label>
              <input
                type="number"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                placeholder="1400"
                className="w-full text-lg p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Código EAN-13</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={codigoGenerado}
                  className="w-full text-base font-mono p-3 bg-slate-50 rounded-xl border border-slate-300 text-slate-600 font-bold"
                />
                <button
                  type="button"
                  onClick={generarNuevoCodigo}
                  className="px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl"
                  title="Generar otro código"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Vista Previa para Imprimir */}
        <div className="mt-8 border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center bg-slate-50">
          <span className="text-xs uppercase font-bold text-slate-400 mb-3">Vista Previa de Etiqueta</span>
          <div className="bg-white p-4 border rounded shadow-sm text-center w-64 flex flex-col items-center">
            <p className="font-bold text-base text-slate-900 leading-tight mb-1">
              {nombre || 'NOMBRE DEL PRODUCTO'}
            </p>
            <p className="font-black text-2xl text-slate-800 mb-2">
              ${precio ? parseFloat(precio).toLocaleString() : '0.00'}
            </p>
            <svg ref={barcodeRef} className="w-full"></svg>
          </div>
        </div>

        <button
          onClick={() => window.print()}
          className="mt-6 w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition"
        >
          <Printer size={20} /> Imprimir Etiqueta Térmica
        </button>
      </div>
    </div>
  );
}