const BUCKET_URL = "https://sportmind-datos.s3.us-east-1.amazonaws.com";
const PREFIX = "JSON_SM/";

export interface SportmindSessionData {
  playerName?: string;
  selectedSport?: string;
  gender?: string;
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
}

export interface SportmindSession {
  timestamp: string;
  session_id: string;
  assigned_specialist?: string | null;
  data: SportmindSessionData;
  raw?: unknown;
}

export type SportmindRecord = SportmindSession;

/**
 * Consulta S3 para obtener todas las URLs de los JSON dinámicamente leyendo el XML.
 */
export async function getDynamicS3Urls(): Promise<string[]> {
  const response = await fetch(`${BUCKET_URL}?prefix=${PREFIX}`);

  if (!response.ok) {
    throw new Error("No se pudo obtener la lista de archivos de S3. Verifica CORS y permisos de la Política.");
  }

  const xmlText = await response.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "application/xml");

  const keys = Array.from(xmlDoc.getElementsByTagName("Key"))
    .map(node => node.textContent)
    .filter(key => key && key.endsWith(".json"));

  return keys.map(key => `${BUCKET_URL}/${key}`);
}

/**
 * Normaliza cualquier estructura recibida al formato estándar SportmindSession
 */
export function normalizeSession(raw: unknown): SportmindSession {
  if (!raw || typeof raw !== "object") {
    return {
      timestamp: new Date().toISOString(),
      session_id: "unknown",
      assigned_specialist: null,
      data: {},
      raw,
    };
  }

  const obj = raw as Record<string, unknown>;

  if (obj.data && typeof obj.data === "object") {
    return {
      timestamp: String(obj.timestamp || new Date().toISOString()),
      session_id: String(obj.session_id || "sin-id"),
      assigned_specialist: (obj.assigned_specialist as string) || null,
      data: obj.data as SportmindSessionData,
      raw,
    };
  }

  return {
    timestamp: String(obj.timestamp || new Date().toISOString()),
    session_id: String(obj.session_id || "sin-id"),
    assigned_specialist: (obj.assigned_specialist as string) || null,
    data: obj as SportmindSessionData,
    raw,
  };
}

/**
 * Consulta un único archivo JSON en AWS S3 y normaliza los datos.
 */
export async function fetchSingleSportmindData(url: string): Promise<SportmindSession[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText} en ${url}`);
  }

  const json = await res.json();
  const items = Array.isArray(json) ? json : [json];
  return items.map(normalizeSession);
}

/**
 * Consulta y combina datos de AWS S3 en paralelo, aplicando el filtro local por códigos vinculados.
 */
export async function fetchSportmindData(sources?: string | string[]): Promise<SportmindSession[]> {
  const urls = sources
    ? (Array.isArray(sources) ? sources : [sources])
    : await getDynamicS3Urls();

  if (urls.length === 0) {
    return [];
  }

  const results = await Promise.allSettled(
    urls.map((url) => fetchSingleSportmindData(url)),
  );

  let combinedRecords: SportmindSession[] = [];
  const errors: string[] = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      combinedRecords.push(...result.value);
    } else {
      console.warn(`Error al obtener datos de ${urls[index]}:`, result.reason);
      errors.push(urls[index]);
    }
  });

  if (combinedRecords.length === 0 && errors.length === urls.length) {
    throw new Error("No se pudo cargar ningún archivo JSON desde S3.");
  }

  // Filtrado por rol y códigos locales en el navegador
  const token = localStorage.getItem("sportmind_token");
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const gruposCrudos = payload["cognito:groups"] || payload["groups"] || [];
      const grupos = Array.isArray(gruposCrudos)
        ? gruposCrudos.map((g: string) => g.toLowerCase())
        : [String(gruposCrudos).toLowerCase()];

      const esAdmin = grupos.some((g) => g.includes("administrador") || g.includes("admin"));

      // Si NO es administrador, filtramos según los códigos de 8 dígitos guardados en el navegador
      if (!esAdmin) {
        const codigosVinculados: string[] = JSON.parse(localStorage.getItem("sportmind_linked_codes") || "[]");
        combinedRecords = combinedRecords.filter((session) => {
          const sessionId = (session.session_id || "").toLowerCase();
          return codigosVinculados.some((codigo) => sessionId.startsWith(codigo));
        });
      }
    } catch (e) {
      console.error("Error al filtrar por códigos locales:", e);
    }
  }

  return combinedRecords.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

export interface FilterOptions {
  query?: string;
  sport?: string;
  gender?: string;
  emotion?: string;
  sortBy?: "date-desc" | "date-asc" | "name-asc" | "shooting-desc" | "climbing-asc";
}

/**
 * Filtra y ordena las sesiones de Sportmind.
 */
export function filterSportmindRecords(
  records: SportmindSession[],
  options: FilterOptions | string = {},
): SportmindSession[] {
  const opts: FilterOptions =
    typeof options === "string" ? { query: options } : options;

  const {
    query = "",
    sport = "all",
    gender = "all",
    emotion = "all",
    sortBy = "date-desc",
  } = opts;

  const cleanQuery = query.toLowerCase().trim();

  let filtered = records.filter((session) => {
    const s = session.data;

    if (sport && sport !== "all") {
      if ((s.selectedSport || "").toLowerCase() !== sport.toLowerCase()) {
        return false;
      }
    }

    if (gender && gender !== "all") {
      if ((s.gender || "").toLowerCase() !== gender.toLowerCase()) {
        return false;
      }
    }

    if (emotion && emotion !== "all") {
      if ((s.emotionalState || "").toLowerCase() !== emotion.toLowerCase()) {
        return false;
      }
    }

    if (cleanQuery) {
      const matchName = (s.playerName || "").toLowerCase().includes(cleanQuery);
      const matchSport = (s.selectedSport || "").toLowerCase().includes(cleanQuery);
      const matchEmotion = (s.emotionalState || "").toLowerCase().includes(cleanQuery);
      const matchId = session.session_id.toLowerCase().includes(cleanQuery);
      const serialized = JSON.stringify(session).toLowerCase();

      if (!matchName && !matchSport && !matchEmotion && !matchId && !serialized.includes(cleanQuery)) {
        return false;
      }
    }

    return true;
  });

  filtered = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "date-asc":
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      case "name-asc":
        return (a.data.playerName || "").localeCompare(b.data.playerName || "");
      case "shooting-desc": {
        const scoreA = (a.data.shootingScoreEasy ?? 0) + (a.data.shootingScoreHard ?? 0);
        const scoreB = (b.data.shootingScoreEasy ?? 0) + (b.data.shootingScoreHard ?? 0);
        return scoreB - scoreA;
      }
      case "climbing-asc": {
        const timeA = (a.data.climbingTimeEasy ?? 999) + (a.data.climbingTimeHard ?? 999);
        const timeB = (b.data.climbingTimeEasy ?? 999) + (b.data.climbingTimeHard ?? 999);
        return timeA - timeB;
      }
      case "date-desc":
      default:
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    }
  });

  return filtered;
}

/**
 * Mapeo de estilos y etiquetas para estados emocionales
 */
export function getEmotionConfig(emotion?: string): {
  label: string;
  badgeClass: string;
  borderClass: string;
  dotClass: string;
  icon: string;
  bgGlow: string;
} {
  const norm = (emotion || "").toLowerCase().trim();
  switch (norm) {
    case "feliz":
    case "alegre":
    case "motivado":
      return {
        label: emotion || "Feliz",
        badgeClass: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
        borderClass: "border-emerald-500/40",
        dotClass: "bg-emerald-400 shadow-emerald-500/50",
        icon: "😊",
        bgGlow: "from-emerald-500/10 to-transparent",
      };
    case "calma":
    case "tranquilo":
    case "concentrado":
      return {
        label: emotion || "Calma",
        badgeClass: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
        borderClass: "border-cyan-500/40",
        dotClass: "bg-cyan-400 shadow-cyan-500/50",
        icon: "😌",
        bgGlow: "from-cyan-500/10 to-transparent",
      };
    case "ansioso":
    case "nervioso":
    case "estresado":
      return {
        label: emotion || "Ansioso",
        badgeClass: "bg-amber-500/10 text-amber-300 border-amber-500/30",
        borderClass: "border-amber-500/40",
        dotClass: "bg-amber-400 shadow-amber-500/50",
        icon: "⚡",
        bgGlow: "from-amber-500/10 to-transparent",
      };
    case "triste":
    case "desanimado":
    case "frustrado":
      return {
        label: emotion || "Triste",
        badgeClass: "bg-purple-500/10 text-purple-300 border-purple-500/30",
        borderClass: "border-purple-500/40",
        dotClass: "bg-purple-400 shadow-purple-500/50",
        icon: "🌧️",
        bgGlow: "from-purple-500/10 to-transparent",
      };
    case "enojado":
    case "molesto":
      return {
        label: emotion || "Enojado",
        badgeClass: "bg-rose-500/10 text-rose-300 border-rose-500/30",
        borderClass: "border-rose-500/40",
        dotClass: "bg-rose-400 shadow-rose-500/50",
        icon: "🔥",
        bgGlow: "from-rose-500/10 to-transparent",
      };
    default:
      return {
        label: emotion || "Neutro",
        badgeClass: "bg-slate-700/50 text-slate-300 border-slate-600/50",
        borderClass: "border-slate-700",
        dotClass: "bg-slate-400 shadow-slate-500/50",
        icon: "👤",
        bgGlow: "from-indigo-500/10 to-transparent",
      };
  }
}

export function formatDateTime(isoString?: string): string {
  if (!isoString) return "Fecha no disponible";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}