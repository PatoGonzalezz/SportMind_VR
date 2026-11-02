import { registrarAccionAWS } from "./loggerservice";
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

export async function generarInformePdf(elemento: HTMLElement, idSesion: string) {
    armarPlantillaPdf(elemento, idSesion); 

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

  pdf.save("Informe_Evaluacion_INF-5893.pdf");
}

export function armarPlantillaPdf(elementoBase: HTMLElement, idSesion: string) {
  let certezaModelo = "83.7%"; 
  let resultadoClase = "Autorregulación Óptima";

  const textosPantalla = Array.from(elementoBase.querySelectorAll("*"));
  const elementoCerteza = textosPantalla.find(el => el.textContent?.includes("Certeza informada por el modelo:"));
  if (elementoCerteza && elementoCerteza.textContent) {
    const match = elementoCerteza.textContent.match(/\d+(\.\d+)?%/);
    if (match) certezaModelo = match[0];
  }

  const plantilla = document.createElement("div");
  plantilla.style.width = "210mm";
  plantilla.style.backgroundColor = "#ffffff";
  plantilla.style.fontFamily = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  plantilla.style.color = "#1e293b";
  plantilla.style.margin = "0";
  plantilla.style.padding = "0";

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

  plantilla.innerHTML = `
    <style>${cssTablas}</style>
    
    <!-- ================= PÁGINA 1 ================= -->
    <div class="pagina-estricta">
      <div class="encabezado-principal">
        <div>
          <h1>SportMind VR Analytics</h1>
          
        </div>
        <div class="encabezado-secundario">
          <h2>Informe de evaluación cognitivo-deportiva</h2>
          <p>REF: INF-5893 | Sesión SM-VR-01</p>
          <p>08-10-2026, 18:35</p>
        </div>
      </div>

      <div class="titulo-seccion">1. Identificación y contexto de la sesión</div>
      <table class="tabla-formal">
        <tbody>
          <tr>
            <td class="bg-gray">Código sesión</td><td><strong>${idSesion}</strong></td>
            <td class="bg-gray">ID de sesión</td><td>SM-VR-01 (primera sesión registrada)</td>
          </tr>
          <tr>
            <td class="bg-gray">Disciplina</td><td>Natación</td>
            <td class="bg-gray">Fecha y hora</td><td>08-10-2026, 18:35</td>
          </tr>
          <tr>
            <td class="bg-gray">Genero</td><td>No registrado</td>
            <td class="bg-gray">Nivel competitivo</td><td>No registrado</td>
          </tr>
          <tr>
            <td class="bg-gray">Evaluador/a</td><td>No registrado</td>
            <td class="bg-gray">Duración de sesión</td><td>No registrado</td>
          </tr>
          <tr>
            <td class="bg-gray">Plataforma</td><td>Realidad virtual inmersiva</td>
            <td class="bg-gray">Equipo HMD</td><td>No registrado</td>
          </tr>
          <tr>
            <td class="bg-gray">Versión software</td><td>No registrado</td>
            <td class="bg-gray">Versión protocolo</td><td>No registrado</td>
          </tr>
        </tbody>
      </table>

      <div class="titulo-seccion">2. Estado previo a la sesión</div>
      <table class="tabla-formal">
        <tbody>
          <tr>
            <td class="bg-gray">Estado emocional pre</td><td>No registrado</td>
            <td class="bg-gray">Instrumento</td><td>No registrado</td>
          </tr>
        </tbody>
      </table>
      <div class="nota-pie">Sin medición previa no es posible estimar el cambio pre-post del estado emocional. Se recomienda aplicar SAM, una EVA de ansiedad o el CSAI-2R abreviado antes de cada sesión.</div>

      <div class="titulo-seccion">3. Desempeño objetivo por tarea</div>
      <table class="tabla-formal">
        <thead>
          <tr>
            <th>Tarea</th><th>Nivel</th><th>Valor</th><th>Observación</th>
          </tr>
        </thead>
        <tbody>
          <tr>
           <td><strong>Tiro</strong></td><td>Fácil</td><td><span style="color: #059669; font-weight: bold;">52 pts</span></td><td>Referencia de la sesión</td>
          </tr>
          <tr>
            <td><strong>Tiro</strong></td><td>Difícil</td><td><span style="color: #ea580c; font-weight: bold;">16 pts</span></td><td>-36 pts frente a fácil (-69,2%)</td>
          </tr>
         <tr>
            <td><strong>Muro / Escalada</strong></td><td>Fácil</td><td>16,6 s</td><td>Tiempo de ejecución; menor es mejor (por confirmar)</td>
          </tr>
          <tr>
            <td><strong>Muro / Escalada</strong></td><td>Difícil</td><td><span style="color: #ea580c; font-weight: bold;">3,6 s</span></td><td>Revisar. Tiempo 4,6 veces menor que en fácil; no plausible si la tarea se completó</td>
          </tr>
        </tbody>
      </table>
      <div class="nota-pie nota-advertencia"><strong>Atención:</strong> Línea base no disponible (primera sesión). El dato de Muro/Escalada en dificultad alta no debe interpretarse hasta confirmar si la tarea fue completada, fallida o abandonada.</div>

      <div class="titulo-seccion">4. Autoevaluación post-tarea (autorreporte, escala 1-5)</div>
      <table class="tabla-formal">
        <thead>
          <tr>
            <th>Tarea</th><th>Rendimiento</th><th>Ritmo</th><th>Confianza</th><th>Contraste con el desempeño objetivo</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Tiro</strong></td><td>5/5</td><td>5/5</td><td>5/5</td><td>Autoevaluación máxima pese a la caída de 69,2% en el puntaje difícil</td>
          </tr>
          <tr>
            <td><strong>Muro/Escalada</strong></td><td>5/5</td><td>4/5</td><td>5/5</td><td>No interpretable hasta verificar los tiempos (sección 3)</td>
          </tr>
        </tbody>
      </table>
      <div class="nota-pie">5 de 6 respuestas están en el máximo de la escala (efecto techo). Se recomienda una EVA de 0 a 100 o una escala Likert de 7 puntos, y calcular un índice de calibración percepción-desempeño.</div>

      <div class="titulo-seccion">5. Estado posterior y tolerancia a la realidad virtual</div>
      <table class="tabla-formal">
        <tbody>
          <tr>
            <td class="bg-gray">Estado emocional post</td><td><span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 9px;">"Calma"</span> en ambas tareas</td>
            <td class="bg-gray">Instrumento</td><td>No registrado</td>
          </tr>
          <tr>
            <td class="bg-gray">Cambio pre-post</td><td>No calculable (sin medición previa)</td>
            <td class="bg-gray">Cibermalestar</td><td>No registrado</td>
          </tr>
          <tr>
            <td class="bg-gray">Presencia (IPQ)</td><td>No registrado</td>
            <td class="bg-gray">Eventos adversos</td><td>No registrado</td>
          </tr>
        </tbody>
      </table>

      <div class="footer-page">
        <span>INF-5893 Plantilla de informe v2</span>
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
          <p style="font-size: 9px; margin: 2px 0; color: #64748b;">REF: INF-5893 | Sesión SM-VR-01 | 08-10-2026, 18:35</p>
        </div>
      </div>

      <div class="titulo-seccion">6. Clasificación automatizada</div>
      <table class="tabla-formal">
        <tbody>
          <tr>
            <td class="bg-gray">Clase asignada</td><td><strong style="color: #0f766e;">✅ ${resultadoClase}</strong></td>
            <td class="bg-gray">Probabilidad</td><td><strong style="color: #ea580c;">${certezaModelo}</strong> (Certeza informada por el modelo)</td>
          </tr>
        
        </tbody>
      </table>
      <div class="nota-pie nota-advertencia"><strong>Resultado de apoyo; no reemplaza la evaluación profesional.</strong> Sin las clases posibles, la calibración ni las variables que explican la clasificación, este resultado no puede interpretarse de forma independiente. Debe leerse junto al desempeño objetivo (sección 3), que muestra una caída marcada en la condición difícil.</div>

      <div class="titulo-seccion">7. Síntesis interpretativa asistida por IA</div>
      <div class="caja-sintesis">
        En esta primera sesión, la persona obtuvo 52 puntos en Tiro fácil y 16 en Tiro difícil, una disminución de 69,2% al aumentar la dificultad. Su autoevaluación se mantuvo en el máximo en ambas condiciones, lo que podría indicar una sobreestimación del propio desempeño en la tarea difícil. Los tiempos de Muro/Escalada requieren verificación antes de interpretarse. Con una sola sesión no es posible establecer tendencias ni la estabilidad del perfil.
      </div>
      <div class="nota-pie">Borrador reformulado a partir de los datos de esta sesión; reemplaza la síntesis original, que estaba truncada. Estado: pendiente de revisión profesional.</div>

      <div class="titulo-seccion">8. Observaciones y recomendaciones profesionales</div>
      
      <!-- CUADRO DE OBSERVACIONES Y FIRMAS MEJORADO -->
      <div style="border: 1px solid #e2e8f0; border-radius: 4px; padding: 15px 15px 10px 15px; margin-bottom: 15px; background-color: #f8fafc;">
        <!-- 3 Líneas para escribir -->
        <div style="border-bottom: 1px solid #cbd5e1; margin-bottom: 18px; width: 100%; height: 5px;"></div>
        <div style="border-bottom: 1px solid #cbd5e1; margin-bottom: 18px; width: 100%; height: 5px;"></div>
        <div style="border-bottom: 1px solid #cbd5e1; margin-bottom: 25px; width: 100%; height: 5px;"></div>
        
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
        La persona se identifica con un código seudónimo; su nombre consta solo en el registro de enrolamiento. El envío de datos a servicios de IA externos requiere consentimiento informado explícito que cubra ese tratamiento, su finalidad y el plazo de conservación. La satisfacción de uso registrada en la sesión (10/10) se excluye del análisis y consta en un registro aparte.
      </div>

      <div class="footer-page">
        <span>INF-5893 Plantilla de informe v2</span>
        <span>Documento no diagnóstico</span>
        <span>Página 2 de 2</span>
      </div>
    </div>
  `;

  return plantilla;
}

export function inicializarGeneradorPdf(): void {
  document.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement | null;
    const btn = target?.closest<HTMLButtonElement>(".btn-pdf-atleta");
   
    
    if (!btn) return;
    event.preventDefault();
    const idSesion = btn.getAttribute("data-id") || "Sin ID";
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = "Generando PDF final...";
    btn.disabled = true;

    let divOculto: HTMLDivElement | undefined;

    try {
      const dialog = btn.closest("dialog");
      const elementoBase = dialog?.firstElementChild as HTMLElement | null ?? btn.closest<HTMLElement>("article") ?? document.body;
      
      const htmlPdf = armarPlantillaPdf(elementoBase, idSesion);
      
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