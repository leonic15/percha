export const TIPO_EVENTO = [
  "trabajo", "playa", "outdoor", "noche", "paseos", "deporte", "formal",
] as const;

export type TipoEvento = (typeof TIPO_EVENTO)[number];

export const EVENTO_CONFIG: Record<
  TipoEvento,
  { label: string; emoji: string; descripcion: string }
> = {
  trabajo:  { label: "Trabajo",  emoji: "💼", descripcion: "Reuniones, oficina, negocios" },
  playa:    { label: "Playa",    emoji: "🏖️", descripcion: "Playa, piscina, sol" },
  outdoor:  { label: "Outdoor",  emoji: "🥾", descripcion: "Trekking, naturaleza, excursiones" },
  noche:    { label: "Salidas",  emoji: "🍽️", descripcion: "Cenas, bares, vida nocturna" },
  paseos:   { label: "Paseos",   emoji: "🛍️", descripcion: "Turismo, shopping, ciudad" },
  deporte:  { label: "Deporte",  emoji: "🏋️", descripcion: "Gym, running, actividad física" },
  formal:   { label: "Formal",   emoji: "🎭", descripcion: "Eventos formales, ceremonias" },
};

export const ESTILOS_VIAJE = [
  "Casual", "Formal", "Sport", "Boho", "Minimalista",
  "Colorido", "Neutros", "Elegante", "Urbano", "Playero",
] as const;

export type EstiloViaje = (typeof ESTILOS_VIAJE)[number];

export const MODO_CONFIG = {
  maleta_liviana: {
    label: "Maleta liviana",
    descripcion: "Menos prendas, más combinaciones. Ideal para viajes cortos o si querés viajar liviano.",
    emoji: "🎒",
  },
  estilo_completo: {
    label: "Estilo completo",
    descripcion: "Cada look diferenciado. Más opciones, más equipaje.",
    emoji: "👗",
  },
} as const;

export type ModoOptimizacion = keyof typeof MODO_CONFIG;

export const ESTADO_CONFIG = {
  borrador:   { label: "Borrador",   color: "text-ink-3" },
  listo:      { label: "Listo",      color: "text-accent" },
  en_viaje:   { label: "En viaje",   color: "text-sky-500" },
  completado: { label: "Completado", color: "text-ink-2" },
} as const;
