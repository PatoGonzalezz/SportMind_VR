/**
 * Variables de comportamiento en RV para el modelo "regulación emocional por conducta".
 *
 * Port exacto de `features_conducta` del notebook Colab_SportMind_modelo_conducta.
 * El orden de NOMBRES_FEATURES_CONDUCTA debe coincidir con el orden de columnas
 * con que se exportó el modelo ONNX (se guarda en modelo_regulacion_conducta.meta.json).
 *
 * Escalas que asume el modelo (según el notebook):
 *  - Puntajes de tiro: 0 a 100 (100 = puntaje perfecto).
 *  - Tiempos de escalada: segundos (menor es mejor).
 */

/**
 * Orden exacto de columnas con que fue exportado modelo_regulacion_conducta.onnx
 * (8 features — sin tiro_perfectos, que se añadió al notebook DESPUÉS de exportar).
 */
export const NOMBRES_FEATURES_CONDUCTA = [
  "tiro_facil",
  "tiro_dificil",
  "tiro_total",
  "tiro_caida_dificultad",
  "muro_facil",
  "muro_dificil",
  "muro_total",
  "muro_ratio_dificultad",
] as const;

export interface SesionConducta {
  shootingScoreEasy?: number | null;
  shootingScoreHard?: number | null;
  climbingTimeEasy?: number | null;
  climbingTimeHard?: number | null;
}

export type ResultadoFeatures =
  | { ok: true; valores: number[] }
  | { ok: false; motivo: string };

const esNumero = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

export function construirFeaturesConducta(s: SesionConducta): ResultadoFeatures {
  const te = s.shootingScoreEasy;
  const td = s.shootingScoreHard;
  const me = s.climbingTimeEasy;
  const md = s.climbingTimeHard;

  // El modelo necesita las dos tareas completas: sin ellas no se puede clasificar.
  if (!esNumero(te) || !esNumero(td)) {
    return { ok: false, motivo: "Faltan los puntajes de tiro (fácil y difícil)." };
  }
  if (!esNumero(me) || !esNumero(md)) {
    return { ok: false, motivo: "Faltan los tiempos de escalada (fácil y difícil)." };
  }
  if (me <= 0) {
    return { ok: false, motivo: "El tiempo de escalada fácil debe ser mayor que 0." };
  }

  return {
    ok: true,
    valores: [
      te, //                     tiro_facil
      td, //                     tiro_dificil
      te + td, //                tiro_total
      te - td, //                tiro_caida_dificultad
      // tiro_perfectos excluido: el ONNX se exportó antes de esta feature
      me, //                     muro_facil
      md, //                     muro_dificil
      me + md, //                muro_total
      md / me, //                muro_ratio_dificultad
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Preparación de la entrada desde una sesión de la plataforma
// ─────────────────────────────────────────────────────────────────────────────

/** Campos de la sesión que usa el modelo (compatible con SportmindSessionData). */
export interface DatosConducta {
  shootingScoreEasy?: unknown;
  shootingScoreHard?: unknown;
  climbingTimeEasy?: unknown;
  climbingTimeHard?: unknown;
}

/**
 * Puntaje máximo posible en la tarea de tiro dentro de la RV.
 *
 * El modelo se entrenó con puntajes de 0 a 100. Si en la RV el máximo real es
 * otro (por ejemplo 30), cámbialo aquí y los puntajes se reescalan a 0-100
 * antes de calcular las variables. CONFIRMAR con quien programó la RV: una
 * sesión real de prueba traía puntajes de 22 y 4.
 */
export const PUNTAJE_TIRO_MAXIMO = 100;

export const UMBRAL_REGULA_BIEN = 0.5;
export const ETIQUETA_OPTIMA = "Autorregulación Óptima";
export const ETIQUETA_INTERVENCION = "Requiere Intervención / Desregulado";

function aNumero(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.trim().replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Convierte una sesión en las 9 variables del modelo (en el orden de
 * NOMBRES_FEATURES_CONDUCTA). A diferencia de `Number(x || 0)`, un dato
 * ausente NO se reemplaza por 0: se rechaza la sesión con un motivo claro.
 */
export function prepararEntradaConducta(datos: DatosConducta): ResultadoFeatures {
  const te = aNumero(datos.shootingScoreEasy);
  const td = aNumero(datos.shootingScoreHard);
  const me = aNumero(datos.climbingTimeEasy);
  const md = aNumero(datos.climbingTimeHard);

  if (te === null || td === null) {
    return { ok: false, motivo: "Faltan los puntajes de tiro (fácil y difícil)." };
  }
  if (me === null || md === null) {
    return { ok: false, motivo: "Faltan los tiempos de escalada (fácil y difícil)." };
  }
  if (te < 0 || td < 0 || te > PUNTAJE_TIRO_MAXIMO || td > PUNTAJE_TIRO_MAXIMO) {
    return {
      ok: false,
      motivo: `Los puntajes de tiro están fuera del rango esperado (0 a ${PUNTAJE_TIRO_MAXIMO}).`,
    };
  }
  if (md < 0) {
    return { ok: false, motivo: "El tiempo de escalada difícil no puede ser negativo." };
  }

  const reescalar = (p: number) =>
    PUNTAJE_TIRO_MAXIMO === 100 ? p : (p * 100) / PUNTAJE_TIRO_MAXIMO;

  return construirFeaturesConducta({
    shootingScoreEasy: reescalar(te),
    shootingScoreHard: reescalar(td),
    climbingTimeEasy: me,
    climbingTimeHard: md,
  });
}

/**
 * Decide la clase igual que `clasificar()` del notebook: probabilidad de
 * "Regula bien" >= 0.5. Si el modelo no entrega probabilidades, usa la clase.
 */
export function clasificarRegulacion(
  probabilidades: number[] | null,
  claseOnnx: number,
): { prediccion: 0 | 1; etiqueta: string } {
  const pBien =
    probabilidades && probabilidades.length >= 2 ? probabilidades[1] : null;
  const prediccion: 0 | 1 =
    pBien !== null ? (pBien >= UMBRAL_REGULA_BIEN ? 1 : 0) : claseOnnx === 1 ? 1 : 0;
  return {
    prediccion,
    etiqueta: prediccion === 1 ? ETIQUETA_OPTIMA : ETIQUETA_INTERVENCION,
  };
}
