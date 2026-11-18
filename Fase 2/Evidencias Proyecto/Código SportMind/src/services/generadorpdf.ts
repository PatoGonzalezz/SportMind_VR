import { registrarAccionAWS } from "./loggerservice";
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
import { getEmotionConfig } from "./sportmindService";
import { analizarSesion } from "./analisisIA";

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------
interface DatosSesion {
  session_id: string;
  timestamp: string;
  data: {
    playerName?: string;
    selectedSport?: string;
    gender?: string;
    playerAge?: number;
    sessionDurationSeconds?: number;
    emotionalState?: string;
    preEmotionTiroEasy?: string | number;
    preEmotionTiroHard?: string | number;
    preEmotionMuroEasy?: string | number;
    preEmotionMuroHard?: string | number;
    shootingScoreEasy?: number;
    shootingScoreHard?: number;
    shootingPostEmotion?: string;
    shootingRendimiento?: number;
    shootingRitmo?: number;
    shootingConfianza?: number;
    climbingTimeEasy?: number;
    climbingTimeHard?: number;
    climbingPostEmotion?: string;
    climbingRendimiento?: number;
    climbingRitmo?: number;
    climbingConfianza?: number;
    recomendacionFinal?: number;
    [key: string]: unknown;
  };
}

export interface InfoIA {
  clase: string;
  certeza: string;
  modelo?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function esc(str: unknown): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDuration(secs: number | undefined): string {
  if (typeof secs !== "number" || !Number.isFinite(secs) || secs <= 0) return "No registrado";
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return m > 0 ? `${m} min ${s} s` : `${s} s`;
}

function fmtDate(ts: string | undefined): string {
  if (!ts) return "No registrado";
  try {
    return new Date(ts).toLocaleString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

function fmtEmocion(val: string | number | undefined): string {
  if (val === undefined || val === null || val === "") return "No registrado";
  const cfg = getEmotionConfig(String(val));
  return cfg?.label ?? String(val);
}

function escalaBar(val: number | undefined, max = 5): string {
  if (typeof val !== "number") return "—/5";
  return `${val}/${max}`;
}

// ---------------------------------------------------------------------------
// Render del PDF
// ---------------------------------------------------------------------------
export async function generarInformePdf(elemento: HTMLElement, idSesion: string) {
  const paginas = Array.from(elemento.querySelectorAll<HTMLElement>(".pagina-estricta"));
  const elementos = paginas.length > 0 ? paginas : [elemento];

  const pdf = new jsPDF({
    unit: "mm",
    format: "a4",
    orientation: "portrait",
  });

  for (let i = 0; i < elementos.length; i++) {
    if (i > 0) {
      pdf.addPage("a4", "portrait");
    }

    const canvas = await html2canvas(elementos[i], {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.98);
    pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);
  }

  pdf.save(`Informe_SportMind_${idSesion}.pdf`);
}

// ---------------------------------------------------------------------------
// Construcción de la plantilla HTML del PDF
// ---------------------------------------------------------------------------
export function armarPlantillaPdf(
  elementoBase: HTMLElement,
  sesion: DatosSesion,
  obsEspecialista: string = "",
  iaInfo?: InfoIA | null,
): HTMLElement {
  const d = sesion.data;
  const idSesion = sesion.session_id;

  // --- Certeza / clase IA ---
  let certezaModelo = iaInfo?.certeza ?? "Sin análisis";
  let resultadoClase = iaInfo?.clase ?? "Pendiente de análisis";
  let modeloUsado = iaInfo?.modelo;

  // Si no se pasó iaInfo explícito o está pendiente, intentar leer del DOM
  if (resultadoClase === "Pendiente de análisis" || resultadoClase === "Sin análisis") {
    const panelIA = elementoBase.querySelector<HTMLElement>('[id^="ia-result-"]');
    if (
      panelIA?.dataset?.iaClase &&
      panelIA.dataset.iaClase !== "Pendiente de análisis" &&
      panelIA.dataset.iaClase !== "Análisis en curso"
    ) {
      resultadoClase = panelIA.dataset.iaClase;
      certezaModelo = panelIA.dataset.iaCerteza || "N/A";
      modeloUsado = panelIA.dataset.iaModelo;
    } else {
      const textosPantalla = Array.from(elementoBase.querySelectorAll("*"));
      const elementoCerteza = textosPantalla.find((el) =>
        el.textContent?.includes("Certeza informada por el modelo:"),
      );
      if (elementoCerteza?.textContent) {
        const matchPct = elementoCerteza.textContent.match(/\d+(\.\d+)?%/);
        if (matchPct) certezaModelo = matchPct[0];
      }
      const elementoClase = elementoBase.querySelector(".ia-diagnosis-title, .ia-result-label");
      if (elementoClase?.textContent?.trim()) {
        const texto = elementoClase.textContent.trim();
        // Excluir placeholders
        if (
          !texto.toLowerCase().includes("pulsa") &&
          !texto.toLowerCase().includes("resultado") &&
          !texto.toLowerCase().includes("analizando") &&
          !texto.toLowerCase().includes("iniciando")
        ) {
          resultadoClase = texto;
        }
      }
      // Fallback: clases reconocidas en el panel IA
      if (resultadoClase === "Pendiente de análisis" && panelIA) {
        const textoPanel = panelIA.textContent || "";
        const clasesConocidas = [
          "Autorregulación Óptima",
          "Desregulación Leve",
          "Desregulación Moderada",
          "Desregulación Severa",
          "Desregulación de Conducta",
        ];
        const encontrada = clasesConocidas.find((c) => textoPanel.includes(c));
        if (encontrada) resultadoClase = encontrada;
      }
    }
  }

  // Identificar si la IA arrojó un resultado válido
  const iaDisponible =
    resultadoClase !== "Pendiente de análisis" &&
    resultadoClase !== "Sin análisis" &&
    resultadoClase !== "Análisis en curso" &&
    resultadoClase !== "Análisis no disponible" &&
    resultadoClase !== "Datos insuficientes";

  let modeloDescripcion = "";
  if (modeloUsado === "conducta") {
    modeloDescripcion = "Modelo de conducta en RV (puntajes de tiro y tiempos de escalada)";
  } else if (modeloUsado === "anterior") {
    modeloDescripcion = "Modelo de autorregulación (modelo de respaldo)";
  } else if (iaDisponible) {
    modeloDescripcion = "Modelo de inferencia ONNX SportMind";
  }

  // --- Datos de la sesión ---
  const nombre = esc(d.playerName || "Atleta sin nombre");
  const deporte = esc(d.selectedSport || "No registrado");
  const genero = esc(d.gender || "No registrado");
  const edad = typeof d.playerAge === "number" ? `${d.playerAge} años` : "No registrado";
  const duracion = fmtDuration(d.sessionDurationSeconds);
  const fechaHora = fmtDate(sesion.timestamp);

  // Emociones pre
  const preEmTiroEasy = fmtEmocion(d.preEmotionTiroEasy);
  const preEmTiroHard = fmtEmocion(d.preEmotionTiroHard);
  const preEmMuroEasy = fmtEmocion(d.preEmotionMuroEasy);
  const preEmMuroHard = fmtEmocion(d.preEmotionMuroHard);

  // Emociones post
  const postEmTiro = fmtEmocion(d.shootingPostEmotion);
  const postEmMuro = fmtEmocion(d.climbingPostEmotion);
  const emocionGeneral = fmtEmocion(d.emotionalState);

  // Scores de tiro
  const tiroFacil = typeof d.shootingScoreEasy === "number" ? d.shootingScoreEasy : null;
  const tiroDificil = typeof d.shootingScoreHard === "number" ? d.shootingScoreHard : null;
  const hayTiro = tiroFacil !== null || tiroDificil !== null;

  // Tiempos de escalada
  const escFacil = typeof d.climbingTimeEasy === "number" ? d.climbingTimeEasy : null;
  const escDificil = typeof d.climbingTimeHard === "number" ? d.climbingTimeHard : null;
  const hayEscalada = escFacil !== null || escDificil !== null;

  // Diferencia porcentual tiro fácil→difícil
  let difTiroPct = "";
  if (tiroFacil !== null && tiroDificil !== null && tiroFacil > 0) {
    const pct = (((tiroDificil - tiroFacil) / tiroFacil) * 100).toFixed(1);
    difTiroPct = `${pct}% vs fácil`;
  }

  // Recomendación final
  const recomendacion =
    typeof d.recomendacionFinal === "number" ? `${d.recomendacionFinal} / 10` : "No registrada";

  // Síntesis generada dinámicamente incluyendo IA
  const sintesis = generarSintesis(d, resultadoClase, certezaModelo);

  // --- CSS compartido ---
  const cssTablas = `
    * { box-sizing: border-box; }
    
    .pagina-estricta { 
      width: 210mm; 
      height: 295mm; 
      padding: 12mm 15mm; 
      position: relative; 
      overflow: hidden; 
      background: white; 
    }
    
    .encabezado-principal { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(90deg, #0f766e 0%, #115e59 100%); color: white; padding: 12px 15px; border-radius: 6px 6px 0 0; margin-bottom: 15px; }
    .encabezado-principal h1 { font-size: 16px; font-weight: 800; margin: 0; letter-spacing: 0.5px; }
    .encabezado-principal p { font-size: 9px; margin: 2px 0 0 0; opacity: 0.9; }
    .encabezado-secundario { text-align: right; }
    .encabezado-secundario h2 { font-size: 11px; font-weight: bold; margin: 0; color: #ccfbf1; text-transform: uppercase; }
    .encabezado-secundario p { font-size: 9px; margin: 2px 0; opacity: 0.9; }
    
    .titulo-seccion { font-size: 11px; font-weight: 700; color: #0f766e; margin: 12px 0 6px 0; padding-bottom: 4px; border-bottom: 2px solid #5eead4; text-transform: uppercase; }
    
    .tabla-formal { width: 100%; border-collapse: collapse; margin-bottom: 5px; font-size: 10px; background-color: #ffffff; border: 1px solid #e2e8f0; }
    .tabla-formal th, .tabla-formal td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; vertical-align: middle; color: #334155; }
    .tabla-formal th { background-color: #f8fafc; font-weight: 700; color: #0f172a; text-transform: uppercase; font-size: 9px; }
    .tabla-formal td.bg-gray { background-color: #f1f5f9; font-weight: 600; width: 18%; color: #475569; }
    
    .nota-pie { font-size: 8.5px; margin-top: 4px; margin-bottom: 10px; color: #64748b; background-color: #f8fafc; padding: 6px 8px; border-left: 3px solid #cbd5e1; border-radius: 0 4px 4px 0; text-align: justify; line-height: 1.4; }
    .nota-advertencia { border-left-color: #f59e0b; background-color: #fffbeb; color: #92400e; }
    
    .caja-sintesis { border: 1px solid #a7f3d0; background-color: #f0fdf4; padding: 10px; font-size: 10px; color: #065f46; text-align: justify; margin-bottom: 8px; line-height: 1.5; border-radius: 4px; }
    
    .footer-page { position: absolute; bottom: 12mm; left: 15mm; right: 15mm; display: flex; justify-content: space-between; font-size: 8px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; font-weight: 500; }
    
    .encabezado-pag2 { display: flex; justify-content: space-between; border-bottom: 2px solid #0f766e; padding-bottom: 8px; margin-bottom: 15px; }
    .encabezado-pag2 h1 { font-size: 14px; font-weight: bold; color: #0f172a; margin: 0; }
    .encabezado-pag2 h2 { font-size: 11px; font-weight: bold; color: #0f766e; margin: 0; text-transform: uppercase; }
  `;

  // --- Fila de tiro ---
  const filaTiroFacil = hayTiro
    ? `<tr>
        <td><strong>Tiro</strong></td><td>Fácil</td>
        <td><span style="color: #059669; font-weight: bold;">${tiroFacil !== null ? tiroFacil + " pts" : "—"}</span></td>
        <td>Referencia de la sesión</td>
       </tr>`
    : "";
  const filaTiroDificil =
    hayTiro && tiroDificil !== null
      ? `<tr>
        <td><strong>Tiro</strong></td><td>Difícil</td>
        <td><span style="color: #ea580c; font-weight: bold;">${tiroDificil} pts</span></td>
        <td>${difTiroPct || "—"}</td>
       </tr>`
      : "";
  const filaEscFacil = hayEscalada
    ? `<tr>
        <td><strong>Muro / Escalada</strong></td><td>Fácil</td>
        <td>${escFacil !== null ? escFacil.toFixed(1) + " s" : "—"}</td>
        <td>Tiempo de ejecución; menor es mejor</td>
       </tr>`
    : "";
  const filaEscDificil =
    hayEscalada && escDificil !== null
      ? `<tr>
        <td><strong>Muro / Escalada</strong></td><td>Difícil</td>
        <td><span style="color: #ea580c; font-weight: bold;">${escDificil.toFixed(1)} s</span></td>
        <td>${escFacil !== null ? `${((escDificil / escFacil) * 100 - 100).toFixed(1)}% vs fácil` : "—"}</td>
       </tr>`
      : "";
  const sinRendimiento =
    !hayTiro && !hayEscalada
      ? `<tr><td colspan="4" style="text-align:center; color:#64748b;">Sin datos de rendimiento registrados</td></tr>`
      : "";

  // --- Autoevaluación ---
  const filaAutoTiro = hayTiro
    ? `<tr>
        <td><strong>Tiro</strong></td>
        <td>${escalaBar(d.shootingRendimiento)}</td>
        <td>${escalaBar(d.shootingRitmo)}</td>
        <td>${escalaBar(d.shootingConfianza)}</td>
        <td>Post-tiro: ${esc(postEmTiro)}</td>
       </tr>`
    : "";
  const filaAutoEsc = hayEscalada
    ? `<tr>
        <td><strong>Muro / Escalada</strong></td>
        <td>${escalaBar(d.climbingRendimiento)}</td>
        <td>${escalaBar(d.climbingRitmo)}</td>
        <td>${escalaBar(d.climbingConfianza)}</td>
        <td>Post-muro: ${esc(postEmMuro)}</td>
       </tr>`
    : "";
  const sinAuto =
    !hayTiro && !hayEscalada
      ? `<tr><td colspan="5" style="text-align:center; color:#64748b;">Sin datos de autoevaluación registrados</td></tr>`
      : "";

  // --- Emociones pre ---
  const hayPreEmociones =
    d.preEmotionTiroEasy || d.preEmotionTiroHard || d.preEmotionMuroEasy || d.preEmotionMuroHard;

  const filasPreEmociones = hayPreEmociones
    ? `<tr>
        <td class="bg-gray">Pre Tiro Fácil</td><td>${esc(preEmTiroEasy)}</td>
        <td class="bg-gray">Pre Tiro Difícil</td><td>${esc(preEmTiroHard)}</td>
       </tr>
       <tr>
        <td class="bg-gray">Pre Muro Fácil</td><td>${esc(preEmMuroEasy)}</td>
        <td class="bg-gray">Pre Muro Difícil</td><td>${esc(preEmMuroHard)}</td>
       </tr>`
    : `<tr>
        <td class="bg-gray">Estado emocional pre</td><td>No registrado</td>
        <td class="bg-gray">Instrumento</td><td>No registrado</td>
       </tr>`;

  // --- Observaciones especialista en PDF ---
  const bloqueObservaciones = obsEspecialista
    ? `<!-- Observaciones escritas por el especialista -->
      <div style="font-size: 10px; color: #1e293b; line-height: 1.6; white-space: pre-wrap; margin-bottom: 18px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0;">${esc(obsEspecialista)}</div>`
    : `<!-- Líneas en blanco para escritura manual -->
      <div style="border-bottom: 1px solid #cbd5e1; margin-bottom: 18px; width: 100%; height: 5px;"></div>
      <div style="border-bottom: 1px solid #cbd5e1; margin-bottom: 18px; width: 100%; height: 5px;"></div>
      <div style="border-bottom: 1px solid #cbd5e1; margin-bottom: 25px; width: 100%; height: 5px;"></div>`;

  const plantilla = document.createElement("div");
  plantilla.style.width = "210mm";
  plantilla.style.backgroundColor = "#ffffff";
  plantilla.style.fontFamily = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  plantilla.style.color = "#1e293b";
  plantilla.style.margin = "0";
  plantilla.style.padding = "0";

  plantilla.innerHTML = `
    <style>${cssTablas}</style>
    
    <!-- ================= PÁGINA 1 ================= -->
    <div class="pagina-estricta">
      <div class="encabezado-principal">
        <div>
          <h1>SportMind VR Analytics</h1>
          <p>${esc(nombre)} · ${esc(deporte)}</p>
        </div>
        <div class="encabezado-secundario">
          <h2>Informe de evaluación cognitivo-deportiva</h2>
          <p>Sesión: ${esc(idSesion)}</p>
          <p>${esc(fechaHora)}</p>
        </div>
      </div>

      <div class="titulo-seccion">1. Identificación y contexto de la sesión</div>
      <table class="tabla-formal">
        <tbody>
          <tr>
            <td class="bg-gray">Código sesión</td><td><strong>${esc(idSesion)}</strong></td>
            <td class="bg-gray">Atleta</td><td>${esc(nombre)}</td>
          </tr>
          <tr>
            <td class="bg-gray">Disciplina</td><td>${esc(deporte)}</td>
            <td class="bg-gray">Fecha y hora</td><td>${esc(fechaHora)}</td>
          </tr>
          <tr>
            <td class="bg-gray">Género</td><td>${esc(genero)}</td>
            <td class="bg-gray">Edad</td><td>${esc(edad)}</td>
          </tr>
          <tr>
            <td class="bg-gray">Duración de sesión</td><td>${esc(duracion)}</td>
            <td class="bg-gray">Recomendación registrada</td><td>${esc(recomendacion)}</td>
          </tr>
          <tr>
            <td class="bg-gray">Plataforma</td><td>Realidad virtual inmersiva</td>
            <td class="bg-gray">Estado emocional general</td><td>${esc(emocionGeneral)}</td>
          </tr>
        </tbody>
      </table>

      <div class="titulo-seccion">2. Estado emocional previo a la sesión</div>
      <table class="tabla-formal">
        <tbody>
          ${filasPreEmociones}
        </tbody>
      </table>
      ${!hayPreEmociones ? '<div class="nota-pie">Sin medición previa registrada. Se recomienda aplicar SAM, EVA de ansiedad o CSAI-2R abreviado antes de cada sesión.</div>' : ""}

      <div class="titulo-seccion">3. Desempeño objetivo por tarea</div>
      <table class="tabla-formal">
        <thead>
          <tr>
            <th>Tarea</th><th>Nivel</th><th>Valor</th><th>Observación</th>
          </tr>
        </thead>
        <tbody>
          ${filaTiroFacil}${filaTiroDificil}${filaEscFacil}${filaEscDificil}${sinRendimiento}
        </tbody>
      </table>

      <div class="titulo-seccion">4. Autoevaluación post-tarea (escala 1–5)</div>
      <table class="tabla-formal">
        <thead>
          <tr>
            <th>Tarea</th><th>Rendimiento</th><th>Ritmo</th><th>Confianza</th><th>Emoción post</th>
          </tr>
        </thead>
        <tbody>
          ${filaAutoTiro}${filaAutoEsc}${sinAuto}
        </tbody>
      </table>

      <div class="titulo-seccion">5. Estado posterior a la sesión</div>
      <table class="tabla-formal">
        <tbody>
          <tr>
            <td class="bg-gray">Emoción post-tiro</td><td>${esc(postEmTiro)}</td>
            <td class="bg-gray">Emoción post-muro</td><td>${esc(postEmMuro)}</td>
          </tr>
          <tr>
            <td class="bg-gray">Estado emocional general</td><td>${esc(emocionGeneral)}</td>
            <td class="bg-gray">Cambio pre→post</td><td>${hayPreEmociones ? "Ver sección 2" : "No calculable (sin medición previa)"}</td>
          </tr>
        </tbody>
      </table>

      <div class="footer-page">
        <span>SportMind VR Analytics · Informe v2</span>
        <span>Documento no diagnóstico</span>
        <span>Página 1 de 2</span>
      </div>
    </div>

    <div class="html2pdf__page-break"></div>

    <!-- ================= PÁGINA 2 ================= -->
    <div class="pagina-estricta">
      <div class="encabezado-pag2">
        <div>
          <h1>SportMind VR Analytics</h1>
          <p style="font-size: 9px; margin: 2px 0 0 0; color: #64748b;">Sistema de evaluación cognitivo-deportiva</p>
        </div>
        <div style="text-align: right;">
          <h2>Informe de evaluación cognitivo-deportiva</h2>
          <p style="font-size: 9px; margin: 2px 0; color: #64748b;">Sesión: ${esc(idSesion)} · ${esc(fechaHora)}</p>
        </div>
      </div>

      <div class="titulo-seccion">6. Clasificación automatizada (IA)</div>
      <table class="tabla-formal">
        <tbody>
          <tr>
            <td class="bg-gray">Clase asignada</td>
            <td><strong style="color: #0f766e;">${iaDisponible ? "✅ " : "⏳ "}${esc(resultadoClase)}</strong></td>
            <td class="bg-gray">Certeza del modelo</td>
            <td><strong style="color: #ea580c;">${esc(certezaModelo)}</strong></td>
          </tr>
          ${
            modeloDescripcion
              ? `<tr>
            <td class="bg-gray">Modelo aplicado</td>
            <td colspan="3">${esc(modeloDescripcion)}</td>
          </tr>`
              : ""
          }
        </tbody>
      </table>
      <div class="nota-pie nota-advertencia"><strong>Resultado de apoyo; no reemplaza la evaluación profesional.</strong> ${
        !iaDisponible
          ? "El modelo no fue ejecutado en esta sesión — el informe se generó sin análisis de IA."
          : "La certeza reflejada es la informada por el modelo en el momento del análisis."
      }</div>

      <div class="titulo-seccion">7. Síntesis interpretativa</div>
      <div class="caja-sintesis">${esc(sintesis)}</div>
      <div class="nota-pie">Síntesis generada a partir de los datos registrados y la predicción automatizada. Estado: pendiente de revisión profesional.</div>

      <div class="titulo-seccion">8. Observaciones y recomendaciones profesionales</div>
      
      <!-- CUADRO DE OBSERVACIONES Y FIRMAS -->
      <div style="border: 1px solid #e2e8f0; border-radius: 4px; padding: 15px 15px 10px 15px; margin-bottom: 15px; background-color: #f8fafc;">
        ${bloqueObservaciones}
        
        <!-- Firmas -->
        <div style="display: flex; justify-content: space-between; font-size: 9px; color: #1e293b; font-weight: 700;">
          <div style="display: flex; align-items: flex-end; width: 33%;">
            <span style="margin-right: 8px;">Nombre profesional</span>
            <div style="border-bottom: 1px solid #94a3b8; flex-grow: 1;"></div>
          </div>
          <div style="display: flex; align-items: flex-end; width: 25%;">
            <span style="margin-right: 8px;">Firma</span>
            <div style="border-bottom: 1px solid #94a3b8; flex-grow: 1;"></div>
          </div>
          <div style="display: flex; align-items: flex-end; width: 32%;">
            <span style="margin-right: 8px;">Fecha de revisión</span>
            <div style="border-bottom: 1px solid #94a3b8; flex-grow: 1;"></div>
          </div>
        </div>
      </div>

      <div class="titulo-seccion">9. Aviso y tratamiento de datos</div>
      <div style="font-size: 8.5px; text-align: justify; margin-bottom: 20px; color: #475569; background-color: #f1f5f9; padding: 10px; border-radius: 4px; border: 1px solid #e2e8f0; line-height: 1.4;">
        <strong>Este informe no constituye diagnóstico.</strong> Las estimaciones automatizadas, obtenidas a partir de telemetría de realidad virtual, complementan la evaluación profesional y no la reemplazan.<br><br>
        La persona se identifica con un código seudónimo; su nombre consta solo en el registro de enrolamiento. El envío de datos a servicios de IA externos requiere consentimiento informado explícito que cubra ese tratamiento, su finalidad y el plazo de conservación.
      </div>

      <div class="footer-page">
        <span>SportMind VR Analytics · Informe v2</span>
        <span>Documento no diagnóstico</span>
        <span>Página 2 de 2</span>
      </div>
    </div>
  `;

  return plantilla;
}

// ---------------------------------------------------------------------------
// Genera una síntesis interpretativa dinámica basada en los datos
// ---------------------------------------------------------------------------
function generarSintesis(
  d: DatosSesion["data"],
  clase: string,
  certeza: string,
): string {
  const partes: string[] = [];

  const nombre = d.playerName || "El/La atleta";

  if (typeof d.shootingScoreEasy === "number" || typeof d.shootingScoreHard === "number") {
    const facil = d.shootingScoreEasy;
    const dificil = d.shootingScoreHard;
    if (facil !== undefined && dificil !== undefined) {
      const cambio = (((dificil - facil) / facil) * 100).toFixed(1);
      const signo = dificil >= facil ? "aumento" : "disminución";
      partes.push(
        `${nombre} obtuvo ${facil} puntos en Tiro fácil y ${dificil} en Tiro difícil, una ${signo} de ${Math.abs(Number(cambio))}% al cambiar el nivel de dificultad.`,
      );
    } else if (facil !== undefined) {
      partes.push(`${nombre} registró ${facil} puntos en Tiro fácil (sin datos en nivel difícil).`);
    } else if (dificil !== undefined) {
      partes.push(`${nombre} registró ${dificil} puntos en Tiro difícil (sin datos en nivel fácil).`);
    }
  }

  if (typeof d.climbingTimeEasy === "number" || typeof d.climbingTimeHard === "number") {
    const te = d.climbingTimeEasy;
    const th = d.climbingTimeHard;
    if (te !== undefined && th !== undefined) {
      partes.push(`En Muro/Escalada completó el recorrido fácil en ${te.toFixed(1)} s y el difícil en ${th.toFixed(1)} s.`);
    } else if (te !== undefined) {
      partes.push(`El tiempo de Muro/Escalada fácil fue ${te.toFixed(1)} s (sin datos en nivel difícil).`);
    } else if (th !== undefined) {
      partes.push(`El tiempo de Muro/Escalada difícil fue ${th.toFixed(1)} s (sin datos en nivel fácil).`);
    }
  }

  if (d.shootingRendimiento !== undefined || d.climbingRendimiento !== undefined) {
    const rT = d.shootingRendimiento;
    const rM = d.climbingRendimiento;
    const parteAuto: string[] = [];
    if (rT !== undefined) parteAuto.push(`Tiro: rendimiento ${rT}/5, ritmo ${d.shootingRitmo ?? "—"}/5, confianza ${d.shootingConfianza ?? "—"}/5`);
    if (rM !== undefined) parteAuto.push(`Muro: rendimiento ${rM}/5, ritmo ${d.climbingRitmo ?? "—"}/5, confianza ${d.climbingConfianza ?? "—"}/5`);
    if (parteAuto.length > 0) partes.push(`Autoevaluación: ${parteAuto.join("; ")}.`);
  }

  if (d.emotionalState || d.shootingPostEmotion || d.climbingPostEmotion) {
    const emos: string[] = [];
    if (d.emotionalState) emos.push(`general: "${d.emotionalState}"`);
    if (d.shootingPostEmotion) emos.push(`post-tiro: "${d.shootingPostEmotion}"`);
    if (d.climbingPostEmotion) emos.push(`post-muro: "${d.climbingPostEmotion}"`);
    partes.push(`Estado emocional registrado — ${emos.join(", ")}.`);
  }

  if (
    clase !== "Pendiente de análisis" &&
    clase !== "Sin análisis" &&
    clase !== "Análisis en curso" &&
    clase !== "Análisis no disponible"
  ) {
    if (clase === "Datos insuficientes") {
      partes.push("La sesión no cuenta con suficientes datos de telemetría para que el modelo de IA genere una clasificación fiable.");
    } else {
      partes.push(`El modelo de IA clasificó la sesión como "${clase}" con una certeza del ${certeza}.`);
    }
  } else {
    partes.push("El análisis automatizado no fue ejecutado; la síntesis se basa exclusivamente en los datos objetivos registrados.");
  }

  if (partes.length === 0) {
    return "No hay suficientes datos registrados en esta sesión para generar una síntesis interpretativa automática. Se recomienda revisar los datos de origen.";
  }

  return partes.join(" ");
}

// ---------------------------------------------------------------------------
// Inicialización del listener de eventos
// ---------------------------------------------------------------------------
export function inicializarGeneradorPdf(): void {
  document.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement | null;
    const btn = target?.closest<HTMLButtonElement>(".btn-pdf-atleta");

    if (!btn) return;
    event.preventDefault();

    // Leer datos de la sesión desde el atributo data-session (base64 JSON)
    const sessionB64 = btn.getAttribute("data-session");
    let sesion: DatosSesion | null = null;
    if (sessionB64) {
      try {
        sesion = JSON.parse(decodeURIComponent(escape(atob(sessionB64))));
      } catch (e) {
        console.warn("No se pudo parsear data-session:", e);
      }
    }

    const idSesion = sesion?.session_id ?? btn.getAttribute("data-id") ?? "Sin-ID";

    const textoOriginal = btn.innerHTML;
    btn.innerHTML = "Generando PDF…";
    btn.disabled = true;

    let divOculto: HTMLDivElement | undefined;

    try {
      const dialog = btn.closest("dialog");
      const elementoBase =
        (dialog?.firstElementChild as HTMLElement | null) ??
        btn.closest<HTMLElement>("article") ??
        document.body;

      // Capturar observaciones del especialista ANTES de armar la plantilla
      const obsTextarea = elementoBase.querySelector<HTMLTextAreaElement>(".obs-especialista");
      const obsTexto = obsTextarea ? obsTextarea.value.trim() : "";

      // Si no tenemos datos de sesión desde el atributo, construir un objeto mínimo
      if (!sesion) {
        sesion = { session_id: idSesion, timestamp: new Date().toISOString(), data: {} };
      }

      // Obtener o resolver el análisis de IA
      let iaInfo: InfoIA | null = null;
      const panelIA = elementoBase.querySelector<HTMLElement>('[id^="ia-result-"]');

      if (
        panelIA?.dataset?.iaClase &&
        panelIA.dataset.iaClase !== "Pendiente de análisis" &&
        panelIA.dataset.iaClase !== "Análisis en curso" &&
        panelIA.dataset.iaClase !== "Análisis no disponible"
      ) {
        iaInfo = {
          clase: panelIA.dataset.iaClase,
          certeza: panelIA.dataset.iaCerteza || "N/A",
          modelo: panelIA.dataset.iaModelo,
        };
      } else {
        // Si no está listo aún en el DOM (o el usuario dio clic a PDF de inmediato sin esperar),
        // ejecutamos el análisis de IA directamente para que el PDF siempre lo incluya
        try {
          const resIA = await analizarSesion(sesion.data);
          if (resIA?.estado === "ok") {
            const prob = resIA.probabilidades
              ? (Math.max(...resIA.probabilidades) * 100).toFixed(1) + "%"
              : "No disponible";
            iaInfo = {
              clase: resIA.etiqueta,
              certeza: prob,
              modelo: resIA.modelo,
            };
          } else if (resIA?.estado === "insuficiente") {
            iaInfo = {
              clase: "Datos insuficientes",
              certeza: "N/A",
            };
          }
        } catch (e) {
          console.warn("No se pudo obtener análisis de IA para el PDF:", e);
        }
      }

      const htmlPdf = armarPlantillaPdf(elementoBase, sesion, obsTexto, iaInfo);

      divOculto = document.createElement("div");
      divOculto.style.position = "fixed";
      divOculto.style.left = "0";
      divOculto.style.top = "0";
      divOculto.style.width = "210mm";
      divOculto.style.zIndex = "-99999";
      divOculto.style.pointerEvents = "none";

      divOculto.appendChild(htmlPdf);
      document.body.appendChild(divOculto);

      await generarInformePdf(divOculto, idSesion);
      await registrarAccionAWS(`Descargó el informe en PDF de la sesión #${idSesion}`);
    } catch (error: any) {
      console.error("Error al exportar:", error);
      alert(`Error al generar el informe: ${error?.message || error}`);
    } finally {
      if (divOculto) divOculto.remove();
      btn.innerHTML = textoOriginal;
      btn.disabled = false;
    }
  });
}
