import type { SportmindSessionData } from "./sportmindService";
import { predecirAutorregulacion } from "./autorregulacion";
import { predecirRegulacionConducta } from "./regulacionConducta";

export type ResultadoAnalisis =
  | {
      estado: "ok";
      /** Qué modelo produjo el resultado: se muestra en la interfaz. */
      modelo: "conducta" | "anterior";
      prediccion: number;
      etiqueta: string;
      probabilidades: number[] | null;
    }
  | { estado: "insuficiente"; motivo: string }
  | { estado: "error" };

/**
 * Punto único de entrada para "Analizar con IA".
 *
 * 1. Usa el modelo de conducta en RV.
 * 2. Si faltan datos de la sesión, lo informa (no inventa valores).
 * 3. Solo si el archivo del modelo nuevo no está o no carga, usa el modelo
 *    anterior y lo deja indicado en el resultado.
 *
 * Para quitar el respaldo al modelo anterior, elimina el bloque del paso 3.
 */
export async function analizarSesion(
  datos: SportmindSessionData,
): Promise<ResultadoAnalisis> {
  const nuevo = await predecirRegulacionConducta(datos);
  if (nuevo.estado === "ok" || nuevo.estado === "insuficiente") return nuevo;

  console.warn("Modelo de conducta no disponible: se usa el modelo anterior.");
  const anterior = await predecirAutorregulacion(datos);
  return anterior
    ? { estado: "ok", modelo: "anterior", ...anterior }
    : { estado: "error" };
}
