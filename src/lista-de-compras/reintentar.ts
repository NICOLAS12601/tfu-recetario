const REINTENTOS = 2; // 3 intentos en total
const ESPERA_BASE_MS = 200; // 200 ms, después 400 ms

/** Reintenta ante fallos transitorios, con espera creciente. */
export async function reintentar<T>(
  llamada: () => Promise<T>,
  esReintentable: (error: unknown) => boolean = () => true,
): Promise<T> {
  for (let intento = 1; ; intento++) {
    try {
      return await llamada();
    } catch (error) {
      if (intento > REINTENTOS || !esReintentable(error)) throw error;
      await new Promise((r) => setTimeout(r, ESPERA_BASE_MS * 2 ** (intento - 1)));
    }
  }
}
