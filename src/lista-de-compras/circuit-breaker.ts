export type EstadoCircuito = 'CERRADO' | 'ABIERTO' | 'SEMIABIERTO';

/**
 * Circuit Breaker:
 * - CERRADO: las llamadas pasan. Con `umbralFallos` fallos seguidos -> ABIERTO.
 * - ABIERTO: no llama, falla al instante. Pasados `esperaMs` -> SEMIABIERTO.
 * - SEMIABIERTO: deja pasar UNA llamada de prueba. Bien -> CERRADO; mal -> ABIERTO.
 */
export class CircuitBreaker {
  private estado: EstadoCircuito = 'CERRADO';
  private fallos = 0;
  private abiertoDesde = 0;
  private pruebaEnCurso = false;

  constructor(
    private readonly umbralFallos: number,
    private readonly esperaMs: number,
    private readonly alCambiar: (de: EstadoCircuito, a: EstadoCircuito) => void = () => {},
    private readonly ahora: () => number = Date.now,
  ) {}

  async ejecutar<T>(llamada: () => Promise<T>): Promise<T> {
    if (this.estado === 'ABIERTO' && this.ahora() - this.abiertoDesde >= this.esperaMs) {
      this.cambiarA('SEMIABIERTO');
    }
    if (this.estado === 'ABIERTO' || this.pruebaEnCurso) {
      throw new Error('Circuito abierto: no se llama al servicio');
    }
    const esPrueba = this.estado === 'SEMIABIERTO';
    this.pruebaEnCurso = esPrueba;
    try {
      const resultado = await llamada();
      this.fallos = 0;
      this.cambiarA('CERRADO');
      return resultado;
    } catch (error) {
      this.fallos++;
      if (esPrueba || this.fallos >= this.umbralFallos) {
        this.abiertoDesde = this.ahora();
        this.cambiarA('ABIERTO');
      }
      throw error;
    } finally {
      if (esPrueba) this.pruebaEnCurso = false;
    }
  }

  private cambiarA(nuevo: EstadoCircuito) {
    if (this.estado === nuevo) return;
    this.alCambiar(this.estado, nuevo);
    this.estado = nuevo;
  }
}
