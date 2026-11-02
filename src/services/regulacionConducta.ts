import * as ort from "onnxruntime-web";
import {
  NOMBRES_FEATURES_CONDUCTA,
  clasificarRegulacion,
  prepararEntradaConducta,
  type DatosConducta,
} from "./conductaFeatures";

/** Modelo exportado desde Colab_SportMind_modelo_conducta_ONNX.ipynb */
const MODEL_URL = "/modelo_regulacion_conducta.onnx";

export type ResultadoConducta =
  | {
      estado: "ok";
      modelo: "conducta";
      prediccion: number;
      etiqueta: string;
      probabilidades: number[] | null;
    }
  | { estado: "insuficiente"; motivo: string }
  | { estado: "modelo_no_disponible" };

let sesionModelo: Promise<ort.InferenceSession> | undefined;

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
 * Clasifica la regulación emocional a partir del comportamiento en la RV
 * (puntajes de tiro y tiempos de escalada). Misma estructura que
 * `predecirAutorregulacion`: la sesión ONNX se crea una vez y se reutiliza.
 *
 * El escalador va DENTRO del ONNX, así que se envían las variables sin
 * estandarizar.
 */
export async function predecirRegulacionConducta(
  datos: DatosConducta,
): Promise<ResultadoConducta> {
  const entrada = prepararEntradaConducta(datos);
  if (!entrada.ok) return { estado: "insuficiente", motivo: entrada.motivo };

  try {
    const sesion = await obtenerSesionModelo();
    const resultados = await sesion.run({
      float_input: new ort.Tensor(
        "float32",
        Float32Array.from(entrada.valores),
        [1, NOMBRES_FEATURES_CONDUCTA.length],
      ),
    });
    const nombreClase = sesion.outputNames[0];
    const nombreProbabilidad = sesion.outputNames[1];
    const claseOnnx = Number(resultados[nombreClase].data[0]);
    const probabilidades =
      nombreProbabilidad && resultados[nombreProbabilidad]
        ? Array.from(resultados[nombreProbabilidad].data, Number)
        : null;

    const { prediccion, etiqueta } = clasificarRegulacion(probabilidades, claseOnnx);
    return { estado: "ok", modelo: "conducta", prediccion, etiqueta, probabilidades };
  } catch (error) {
    console.error("Error al ejecutar el modelo de conducta (ONNX):", error);
    return { estado: "modelo_no_disponible" };
  }
}
