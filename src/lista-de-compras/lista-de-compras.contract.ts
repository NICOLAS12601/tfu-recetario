export interface ItemListaDeCompras {
  productoId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface ListaDeCompras {
  recetaIds: string[];
  items: ItemListaDeCompras[];
  total: number;
}
