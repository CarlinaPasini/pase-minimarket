function calcularDigitoVerificadorEAN13(codigo12: string): number {
  let suma = 0;
  for (let i = 0; i < 12; i++) {
    const digito = parseInt(codigo12[i], 10);
    suma += (i % 2 === 0) ? digito : digito * 3;
  }
  const residuo = suma % 10;
  return residuo === 0 ? 0 : 10 - residuo;
}

export function generarCodigoInterno(correlativo: number): string {
  // Prefijo 20 estándar para productos a granel/pesables de uso interno
  const cuerpo = '20' + String(correlativo).padStart(10, '0');
  const verificador = calcularDigitoVerificadorEAN13(cuerpo);
  return `${cuerpo}${verificador}`;
}