export interface ItemListaDeCompras {
  productoId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number | null;
  subtotal: number | null;
  // actual: vino de Precios ahora | no actualizado: de la caché |
  // no disponible: Precios caído y nunca se obtuvo un precio
  estadoPrecio: 'actual' | 'no actualizado' | 'no disponible';
}

export interface ListaDeCompras {
  recetaIds: string[];
  items: ItemListaDeCompras[];
  total: number;
}
