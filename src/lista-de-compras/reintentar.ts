function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function reintentar(operacion: () => Promise<number>, intentosMaximos: number, esperaMs: number) {
  for (let intento = 1; intento < intentosMaximos; intento++) {
    try {
      return await operacion();
    } catch {
      await esperar(esperaMs);
    }
  }
  return operacion();
}
