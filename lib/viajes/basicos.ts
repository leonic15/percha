import type { Profile } from "@/lib/database.types";
import type { ModoOptimizacion } from "./constants";

type Genero = Profile["genero"];

export interface BasicoSugerido {
  tipo_prenda: string;
  cantidad: number;
}

export function calcularBasicos(
  dias: number,
  genero: Genero,
  modo: ModoOptimizacion
): BasicoSugerido[] {
  if (!genero || genero === "prefiero_no_decirlo") return [];

  const liviana = modo === "maleta_liviana";
  const normal  = (n: number) => Math.max(1, Math.ceil(liviana ? n / 1.5 : n));
  const mitad   = (n: number) => Math.max(1, Math.ceil(liviana ? n / 2   : n / 1.5));

  if (genero === "hombre") {
    return [
      { tipo_prenda: "Calzoncillos",     cantidad: normal(dias) },
      { tipo_prenda: "Medias",           cantidad: normal(dias) },
      { tipo_prenda: "Camiseta interior", cantidad: mitad(dias) },
    ];
  }

  return [
    { tipo_prenda: "Bombachas", cantidad: normal(dias) },
    { tipo_prenda: "Corpiños",  cantidad: mitad(dias) },
    { tipo_prenda: "Medias",    cantidad: normal(dias) },
  ];
}

export function diasEntreFechas(inicio: string, fin: string): number {
  const ms = new Date(fin).getTime() - new Date(inicio).getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)) + 1);
}
