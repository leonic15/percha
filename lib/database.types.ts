/**
 * Tipos TypeScript del schema de Supabase — LOOKSI-027
 *
 * Generados manualmente en base a la migración inicial.
 * Una vez el proyecto Supabase esté creado, reemplazar con:
 *   npx supabase gen types typescript --project-id <id> > lib/database.types.ts
 *
 * Nota: cada tabla necesita `Relationships: []` para que supabase-js infiera
 * los tipos de Row/Insert/Update correctamente (GenericTable constraint).
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    // Views y Functions son requeridos por GenericSchema de supabase-js
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          idioma: string;
          tema: string;
          clima_habilitado: boolean;
          ciudad_nombre: string | null;
          ciudad_latitud: number | null;
          ciudad_longitud: number | null;
          ciudad_pais: string | null;
          estilos_favoritos: string[];
          ocasiones_frecuentes: string[];
          // LOOKSI-033
          genero: 'hombre' | 'mujer' | 'prefiero_no_decirlo' | null;
          altura_cm: number | null;
          peso_kg: number | null;
          // LOOKSI-034
          body_photo_url: string | null;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          idioma?: string;
          tema?: string;
          clima_habilitado?: boolean;
          ciudad_nombre?: string | null;
          ciudad_latitud?: number | null;
          ciudad_longitud?: number | null;
          ciudad_pais?: string | null;
          estilos_favoritos?: string[];
          ocasiones_frecuentes?: string[];
          genero?: 'hombre' | 'mujer' | 'prefiero_no_decirlo' | null;
          altura_cm?: number | null;
          peso_kg?: number | null;
          body_photo_url?: string | null;
          updated_at?: string;
        };
        Update: {
          full_name?: string | null;
          avatar_url?: string | null;
          idioma?: string;
          tema?: string;
          clima_habilitado?: boolean;
          ciudad_nombre?: string | null;
          ciudad_latitud?: number | null;
          ciudad_longitud?: number | null;
          ciudad_pais?: string | null;
          estilos_favoritos?: string[];
          ocasiones_frecuentes?: string[];
          genero?: 'hombre' | 'mujer' | 'prefiero_no_decirlo' | null;
          altura_cm?: number | null;
          peso_kg?: number | null;
          body_photo_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: number;
          nombre: string;
          slug: string;
        };
        Insert: {
          nombre: string;
          slug: string;
        };
        Update: {
          nombre?: string;
          slug?: string;
        };
        Relationships: [];
      };
      subcategories: {
        Row: {
          id: number;
          category_id: number;
          nombre: string;
          slug: string;
        };
        Insert: {
          category_id: number;
          nombre: string;
          slug: string;
        };
        Update: {
          category_id?: number;
          nombre?: string;
          slug?: string;
        };
        Relationships: [];
      };
      prendas: {
        Row: {
          id: string;
          user_id: string;
          nombre: string;
          category_id: number | null;
          subcategory_id: number | null;
          color_principal: string | null;
          estaciones: string[];
          estilos: string[];
          ocasiones: string[];
          estado: "nueva" | "buena" | "desgastada" | null;
          notas: string | null;
          etiquetas: string[];
          imagen_url: string | null;
          is_favorite: boolean;
          ia_analizada: boolean;
          ia_descripcion: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          nombre: string;
          category_id?: number | null;
          subcategory_id?: number | null;
          color_principal?: string | null;
          estaciones?: string[];
          estilos?: string[];
          ocasiones?: string[];
          estado?: "nueva" | "buena" | "desgastada" | null;
          notas?: string | null;
          etiquetas?: string[];
          imagen_url?: string | null;
          is_favorite?: boolean;
          ia_analizada?: boolean;
          ia_descripcion?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          nombre?: string;
          category_id?: number | null;
          subcategory_id?: number | null;
          color_principal?: string | null;
          estaciones?: string[];
          estilos?: string[];
          ocasiones?: string[];
          estado?: "nueva" | "buena" | "desgastada" | null;
          notas?: string | null;
          etiquetas?: string[];
          imagen_url?: string | null;
          is_favorite?: boolean;
          ia_analizada?: boolean;
          ia_descripcion?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      looks: {
        Row: {
          id: string;
          user_id: string;
          nombre: string;
          descripcion_ia: string | null;
          parametros_generacion: Json;
          vestir_imagen_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          nombre: string;
          descripcion_ia?: string | null;
          parametros_generacion?: Json;
          vestir_imagen_url?: string | null;
        };
        Update: {
          nombre?: string;
          descripcion_ia?: string | null;
          parametros_generacion?: Json;
          vestir_imagen_url?: string | null;
        };
        Relationships: [];
      };
      look_prendas: {
        Row: {
          id: string;
          look_id: string;
          prenda_id: string | null;
          es_prenda_base: boolean;
          prenda_eliminada: boolean;
        };
        Insert: {
          id?: string;
          look_id: string;
          prenda_id?: string | null;
          es_prenda_base?: boolean;
          prenda_eliminada?: boolean;
        };
        Update: {
          prenda_id?: string | null;
          es_prenda_base?: boolean;
          prenda_eliminada?: boolean;
        };
        Relationships: [];
      };
      look_usos: {
        Row: {
          id: string;
          look_id: string;
          fecha_uso: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          look_id: string;
          fecha_uso: string;
        };
        Update: never;
        Relationships: [];
      };
      ai_usage: {
        Row: {
          id: string;
          user_id: string;
          tipo: "analisis_prenda" | "generacion_look" | "cambio_prenda";
          tokens_usados: number | null;
          costo_estimado: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tipo: "analisis_prenda" | "generacion_look" | "cambio_prenda";
          tokens_usados?: number | null;
          costo_estimado?: number | null;
        };
        Update: never;
        Relationships: [];
      };
      viajes: {
        Row: {
          id: string;
          user_id: string;
          nombre: string;
          fecha_inicio: string;
          fecha_fin: string;
          modo_optimizacion: "maleta_liviana" | "estilo_completo";
          estado: "borrador" | "listo" | "en_viaje" | "completado";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          nombre: string;
          fecha_inicio: string;
          fecha_fin: string;
          modo_optimizacion?: "maleta_liviana" | "estilo_completo";
          estado?: "borrador" | "listo" | "en_viaje" | "completado";
        };
        Update: {
          nombre?: string;
          fecha_inicio?: string;
          fecha_fin?: string;
          modo_optimizacion?: "maleta_liviana" | "estilo_completo";
          estado?: "borrador" | "listo" | "en_viaje" | "completado";
          updated_at?: string;
        };
        Relationships: [];
      };
      destinos: {
        Row: {
          id: string;
          viaje_id: string;
          ciudad: string;
          pais: string;
          orden: number;
        };
        Insert: {
          id?: string;
          viaje_id: string;
          ciudad: string;
          pais: string;
          orden?: number;
        };
        Update: {
          ciudad?: string;
          pais?: string;
          orden?: number;
        };
        Relationships: [];
      };
      viaje_eventos: {
        Row: {
          id: string;
          viaje_id: string;
          tipo: "trabajo" | "playa" | "outdoor" | "noche" | "paseos" | "deporte" | "formal";
          cantidad_looks: number;
        };
        Insert: {
          id?: string;
          viaje_id: string;
          tipo: "trabajo" | "playa" | "outdoor" | "noche" | "paseos" | "deporte" | "formal";
          cantidad_looks?: number;
        };
        Update: {
          tipo?: "trabajo" | "playa" | "outdoor" | "noche" | "paseos" | "deporte" | "formal";
          cantidad_looks?: number;
        };
        Relationships: [];
      };
      viaje_preferencias_prendas: {
        Row: {
          id: string;
          viaje_id: string;
          prenda_id: string;
          tipo: "incluir" | "excluir";
        };
        Insert: {
          id?: string;
          viaje_id: string;
          prenda_id: string;
          tipo: "incluir" | "excluir";
        };
        Update: {
          tipo?: "incluir" | "excluir";
        };
        Relationships: [];
      };
      viaje_preferencias_estilos: {
        Row: {
          id: string;
          viaje_id: string;
          estilo: string;
        };
        Insert: {
          id?: string;
          viaje_id: string;
          estilo: string;
        };
        Update: {
          estilo?: string;
        };
        Relationships: [];
      };
      viaje_looks: {
        Row: {
          id: string;
          viaje_id: string;
          viaje_evento_id: string;
          nombre: string;
          descripcion_ia: string | null;
          numero_en_evento: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          viaje_id: string;
          viaje_evento_id: string;
          nombre: string;
          descripcion_ia?: string | null;
          numero_en_evento?: number;
        };
        Update: {
          nombre?: string;
          descripcion_ia?: string | null;
          numero_en_evento?: number;
        };
        Relationships: [];
      };
      viaje_look_prendas: {
        Row: {
          id: string;
          viaje_look_id: string;
          prenda_id: string;
        };
        Insert: {
          id?: string;
          viaje_look_id: string;
          prenda_id: string;
        };
        Update: never;
        Relationships: [];
      };
      viaje_basicos_sugeridos: {
        Row: {
          id: string;
          viaje_id: string;
          tipo_prenda: string;
          cantidad: number;
        };
        Insert: {
          id?: string;
          viaje_id: string;
          tipo_prenda: string;
          cantidad?: number;
        };
        Update: {
          cantidad?: number;
        };
        Relationships: [];
      };
    };
  };
}

// ── Tipos de conveniencia para uso en la app ──────────────────────────────────

export type Profile      = Database["public"]["Tables"]["profiles"]["Row"];
export type Category     = Database["public"]["Tables"]["categories"]["Row"];
export type Subcategory  = Database["public"]["Tables"]["subcategories"]["Row"];
export type Prenda       = Database["public"]["Tables"]["prendas"]["Row"];
export type Look         = Database["public"]["Tables"]["looks"]["Row"];
export type LookPrenda   = Database["public"]["Tables"]["look_prendas"]["Row"];
export type LookUso      = Database["public"]["Tables"]["look_usos"]["Row"];
export type AiUsage      = Database["public"]["Tables"]["ai_usage"]["Row"];
export type Viaje        = Database["public"]["Tables"]["viajes"]["Row"];
export type Destino      = Database["public"]["Tables"]["destinos"]["Row"];
export type ViajeEvento  = Database["public"]["Tables"]["viaje_eventos"]["Row"];
export type ViajeLook    = Database["public"]["Tables"]["viaje_looks"]["Row"];
export type ViajeBasico  = Database["public"]["Tables"]["viaje_basicos_sugeridos"]["Row"];

// Tipos de insert/update
export type PrendaInsert = Database["public"]["Tables"]["prendas"]["Insert"];
export type PrendaUpdate = Database["public"]["Tables"]["prendas"]["Update"];
export type LookInsert   = Database["public"]["Tables"]["looks"]["Insert"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

// Tipos de dominio extendidos (con joins frecuentes)
export type PrendaConCategoria = Prenda & {
  category: Pick<Category, "nombre" | "slug"> | null;
  subcategory: Pick<Subcategory, "nombre" | "slug"> | null;
};

export type LookConPrendas = Look & {
  look_prendas: (LookPrenda & { prenda: Prenda | null })[];
  look_usos: LookUso[];
};
