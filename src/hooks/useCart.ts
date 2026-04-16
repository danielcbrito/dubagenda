import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CartItem {
  id: string;
  nome: string;
  preco: number;
  preco_promocional: number | null;
  imagem_url: string | null;
  quantidade: number;
  estoque: number;
}

const CART_KEY_PREFIX = "dub_cart_";

function getCartKey(userId: string, tenantId: string | null) {
  // Tenant-scoped key. Falls back to "_no-tenant" when no tenant is set.
  return `${CART_KEY_PREFIX}${userId}__${tenantId ?? "no-tenant"}`;
}

function loadCart(userId: string | null, tenantId: string | null): CartItem[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(getCartKey(userId, tenantId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCart(userId: string | null, tenantId: string | null, items: CartItem[]) {
  if (!userId) return;
  try {
    const key = getCartKey(userId, tenantId);
    if (items.length === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(items));
    }
  } catch {
    // storage full or unavailable — silent fail
  }
}

export function useCart(tenantId: string | null = null) {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const initializedRef = useRef(false);
  const userReadyRef = useRef(false);

  // Get current user ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      const id = user?.id ?? null;
      setUserId(id);
      userReadyRef.current = true;
      setItems(loadCart(id, tenantId));
      initializedRef.current = true;
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const id = session?.user?.id ?? null;
      setUserId(id);
      userReadyRef.current = true;
      setItems(loadCart(id, tenantId));
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload items whenever tenant changes (after user is ready)
  useEffect(() => {
    if (userReadyRef.current) {
      setItems(loadCart(userId, tenantId));
    }
  }, [tenantId, userId]);

  // Persist whenever items change (after initial load)
  useEffect(() => {
    if (initializedRef.current) {
      saveCart(userId, tenantId, items);
    }
  }, [items, userId, tenantId]);

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
