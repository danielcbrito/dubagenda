import { useState, useCallback } from "react";

export interface CartItem {
  id: string;
  nome: string;
  preco: number;
  preco_promocional: number | null;
  imagem_url: string | null;
  quantidade: number;
  estoque: number;
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((produto: {
    id: string;
    nome: string;
    preco: number;
    preco_promocional: number | null;
    imagem_url: string | null;
    estoque: number;
  }) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === produto.id);
      if (existing) {
        if (existing.quantidade >= produto.estoque) return prev;
        return prev.map((i) =>
          i.id === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i
        );
      }
      return [...prev, { ...produto, quantidade: 1 }];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((i) => {
          if (i.id !== id) return i;
          const next = i.quantidade + delta;
          if (next <= 0) return null;
          if (next > i.estoque) return i;
          return { ...i, quantidade: next };
        })
        .filter(Boolean) as CartItem[]
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((s, i) => s + i.quantidade, 0);
  const totalPrice = items.reduce((s, i) => {
    const price = i.preco_promocional != null && i.preco_promocional < i.preco
      ? i.preco_promocional
      : i.preco;
    return s + price * i.quantidade;
  }, 0);

  return { items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice };
}
