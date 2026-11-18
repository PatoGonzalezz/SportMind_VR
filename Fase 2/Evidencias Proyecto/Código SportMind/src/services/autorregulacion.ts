import * as ort from "onnxruntime-web";
import type { SportmindSessionData } from "./sportmindService";

const MODEL_URL = "/modelo_autoregulacion.onnx";

export type ResultadoAutorregulacion = {
  prediccion: number;
  etiqueta: "Autorregulación Óptima" | "Requiere Intervención / Desregulado";
  probabilidades: number[] | null;
};

let sesionModelo: Promise<ort.InferenceSession> | undefined;

function codificarDeporte(deporte?: string): number {
  const valor = (deporte || "").toLowerCase();
  if (valor.includes("escalada")) return 0;
  if (valor.includes("tiro")) return 1;
  return 0;
}

function codificarGenero(genero?: string): number {
  return (genero || "").toLowerCase() === "femenino" ? 0 : 1;
}

function codificarEmocion(emocion?: string): number {
  const emociones: Record<string, number> = {
    calma: 0,
    feliz: 1,
    nervioso: 2,
    triste: 3,
    enojado: 4,
    neutral: 5,
  };
  return emociones[(emocion || "").toLowerCase()] ?? 0;
}

function obtenerSesionModelo(): Promise<ort.InferenceSession> {
  if (!sesionModelo) {
    sesionModelo = ort.InferenceSession.create(MODEL_URL).catch((error) => {
      sesionModelo = undefined;
      throw error;
    });
  }
  return sesionModelo;
}

/**
 * Ejecuta el modelo ONNX. La sesión se inicializa una vez y se reutiliza en
 * las siguientes consultas, evitando descargar y preparar el modelo repetidamente.
 */
export async function predecirAutorregulacion(
  datos: SportmindSessionData,
): Promise<ResultadoAutorregulacion | null> {
  try {
    const sesion = await obtenerSesionModelo();
    const entrada = Float32Array.from([
      codificarDeporte(datos.selectedSport),
      codificarGenero(datos.gender),
      codificarEmocion(datos.emotionalState),
      Number(datos.preEmotionTiroEasy || 0),
      Number(datos.preEmotionTiroHard || 0),
      Number(datos.preEmotionMuroEasy || 0),
      Number(datos.preEmotionMuroHard || 0),
      Number(datos.shootingScoreEasy || 0),
      Number(datos.shootingScoreHard || 0),
      Number(datos.shootingRendimiento || 0),
      Number(datos.shootingRitmo || 0),
      Number(datos.shootingConfianza || 0),
      codificarEmocion(datos.shootingPostEmotion),
      Number(datos.climbingTimeEasy || 0),
      Number(datos.climbingTimeHard || 0),
      Number(datos.climbingRendimiento || 0),
      Number(datos.climbingRitmo || 0),
      Number(datos.climbingConfianza || 0),
      codificarEmocion(datos.climbingPostEmotion),
      Number(datos.recomendacionFinal || 0),
    ]);
    const resultados = await sesion.run({
      float_input: new ort.Tensor("float32", entrada, [1, 20]),
    });
    const nombrePrediccion = sesion.outputNames[0];
    const nombreProbabilidad = sesion.outputNames[1];
    const prediccion = Number(resultados[nombrePrediccion].data[0]);
    const probabilidades = nombreProbabilidad && resultados[nombreProbabilidad]
      ? Array.from(resultados[nombreProbabilidad].data, Number)
      : null;

    return {
      prediccion,
      etiqueta: prediccion === 1
        ? "Autorregulación Óptima"
        : "Requiere Intervención / Desregulado",
      probabilidades,
    };
  } catch (error) {
    console.error("Error al ejecutar la IA nativa (ONNX):", error);
    return null;
  }
}
