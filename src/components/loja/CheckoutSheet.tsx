import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Store, CreditCard, QrCode, Banknote, Check, ShoppingBag, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { CartItem } from "@/hooks/useCart";

interface CheckoutSheetProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  selectedIds: Set<string>;
  onOrderPlaced: () => void;
  tenantId: string;
  tenantNome: string;
}

type PaymentMethod = "barbearia" | "pix" | "cartao";

export function CheckoutSheet({
  open,
  onClose,
  items,
  selectedIds,
  onOrderPlaced,
  tenantId,
  tenantNome,
}: CheckoutSheetProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("barbearia");
  const [placing, setPlacing] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");

  const selectedItems = useMemo(
    () => items.filter((i) => selectedIds.has(i.id)),
    [items, selectedIds]
  );

  const subtotal = useMemo(
    () =>
      selectedItems.reduce((sum, item) => {
        const price =
          item.preco_promocional != null && item.preco_promocional < item.preco
            ? item.preco_promocional
            : item.preco;
        return sum + price * item.quantidade;
      }, 0),
    [selectedItems]
  );

  const totalQty = selectedItems.reduce((s, i) => s + i.quantidade, 0);

  const handlePlaceOrder = async () => {
    if (placing) return;
    setPlacing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const numero = `PED-${Date.now().toString(36).toUpperCase()}`;

      const { data: pedido, error: pedidoError } = await supabase
        .from("pedidos")
        .insert({
          user_id: user.id,
          tenant_id: tenantId,
          cliente_id: user.id,
          numero_pedido: numero,
          status: paymentMethod === "barbearia" ? "pending_pickup" : "pending_payment",
          valor_total: subtotal,
          subtotal: subtotal,
          total: subtotal,
          desconto: 0,
          forma_pagamento: paymentMethod,
          payment_provider: "manual",
          payment_method: paymentMethod,
          reservation_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select("id")
        .single();

      if (pedidoError) throw pedidoError;

      const pedidoItens = selectedItems.map((item) => {
        const price =
          item.preco_promocional != null && item.preco_promocional < item.preco
            ? item.preco_promocional
            : item.preco;
        return {
          pedido_id: pedido.id,
          produto_id: item.id,
          nome_produto: item.nome,
          quantidade: item.quantidade,
          preco_unitario: price,
          subtotal: price * item.quantidade,
        };
      });

      const { error: itensError } = await supabase
        .from("pedido_itens")
        .insert(pedidoItens);

      if (itensError) throw itensError;

      setOrderNumber(numero);
      setOrderPlaced(true);
      onOrderPlaced();

      toast.success("Pedido realizado com sucesso!", {
        description: `Nº ${numero}`,
      });
    } catch (err: any) {
      console.error("Erro ao criar pedido:", err);
      toast.error("Erro ao realizar pedido", {
        description: err.message || "Tente novamente.",
      });
    } finally {
      setPlacing(false);
    }
  };

  const handleClose = () => {
    setOrderPlaced(false);
    setOrderNumber("");
    setPaymentMethod("barbearia");
    onClose();
  };

  if (!open) return null;

  // Order success screen
  if (orderPlaced) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[55] bg-background flex flex-col items-center justify-center px-8"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: "spring", damping: 20 }}
          className="flex flex-col items-center gap-4 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <Check className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Pedido Confirmado!</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {paymentMethod === "barbearia"
              ? "Retire e pague seu pedido na barbearia."
              : "Aguardando confirmação de pagamento."}
          </p>
          <div className="px-4 py-2.5 rounded-lg bg-card border border-border/30">
            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">Nº do Pedido</p>
            <p className="text-sm font-bold text-foreground tabular-nums">{orderNumber}</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleClose}
            className="mt-4 px-8 py-3.5 rounded-xl text-sm font-bold bg-foreground text-background cursor-pointer"
          >
            Voltar à Loja
          </motion.button>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 320 }}
      className="fixed inset-0 z-[55] bg-background flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 flex-shrink-0">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleClose}
          className="w-9 h-9 flex items-center justify-center cursor-pointer rounded-full"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </motion.button>
        <h2 className="text-base font-bold text-foreground tracking-tight">Confirmar Pedido</h2>
      </div>

      <div className="h-px bg-border/30" />

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-32">
        {/* Store info */}
        <div className="px-5 py-4 bg-card/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center">
              <Store className="w-5 h-5 text-muted-foreground/40" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{tenantNome}</p>
              <p className="text-[11px] text-muted-foreground/60">Loja</p>
            </div>
          </div>
        </div>

        <div className="h-2 bg-muted/10" />

        {/* Order items */}
        <div className="px-5 py-4 space-y-3">
          <h3 className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
            Produtos ({totalQty})
          </h3>
          {selectedItems.map((item) => {
            const price =
              item.preco_promocional != null && item.preco_promocional < item.preco
                ? item.preco_promocional
                : item.preco;
            return (
              <div key={item.id} className="flex gap-3 items-center">
                <div className="w-14 h-14 rounded-xl bg-muted/15 overflow-hidden flex-shrink-0 border border-border/20">
                  {item.imagem_url ? (
                    <img src={item.imagem_url} alt={item.nome} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-4 h-4 text-muted-foreground/10" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug">{item.nome}</p>
                  <p className="text-sm font-bold text-foreground tabular-nums mt-1">
                    R$ {price.toFixed(2)}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground/50 flex-shrink-0">x{item.quantidade}</span>
              </div>
            );
          })}
        </div>

        <div className="h-2 bg-muted/10" />

        {/* Delivery option */}
        <div className="px-5 py-4 space-y-3">
          <h3 className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
            Forma de Entrega
          </h3>
          <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-3.5 flex items-center gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-primary flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Retirar na Barbearia</p>
              <p className="text-[11px] text-muted-foreground/60">Retire seu pedido diretamente no local</p>
            </div>
            <MapPin className="w-4 h-4 text-primary/60 flex-shrink-0" />
          </div>
        </div>

        <div className="h-2 bg-muted/10" />

        {/* Payment methods */}
        <div className="px-5 py-4 space-y-3">
          <h3 className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
            Método de Pagamento
          </h3>
          <div className="space-y-2.5">
            <PaymentOption
              icon={<Banknote className="w-4.5 h-4.5" />}
              label="Pagar na Barbearia"
              description="Pague ao retirar o produto"
              selected={paymentMethod === "barbearia"}
              onSelect={() => setPaymentMethod("barbearia")}
            />
            <PaymentOption
              icon={<QrCode className="w-4.5 h-4.5" />}
              label="Pix"
              description="Em breve"
              selected={paymentMethod === "pix"}
              onSelect={() => {}}
              disabled
            />
            <PaymentOption
              icon={<CreditCard className="w-4.5 h-4.5" />}
              label="Cartão de Crédito"
              description="Em breve"
              selected={paymentMethod === "cartao"}
              onSelect={() => {}}
              disabled
            />
          </div>
        </div>

        <div className="h-2 bg-muted/10" />

        {/* Order summary */}
        <div className="px-5 py-4 space-y-3">
          <h3 className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
            Detalhes do Pagamento
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Subtotal ({totalQty} {totalQty === 1 ? "item" : "itens"})</span>
              <span className="text-sm text-foreground tabular-nums">R$ {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Retirada</span>
              <span className="text-sm text-emerald-500 font-medium">Grátis</span>
            </div>
            <div className="h-px bg-border/20 my-1" />
            <div className="flex justify-between">
              <span className="text-sm font-bold text-foreground">Total</span>
              <span className="text-lg font-bold text-foreground tabular-nums">R$ {subtotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div
        className="flex-shrink-0 bg-background/95 backdrop-blur-lg border-t border-border/30 px-5 pt-3.5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest font-medium">Total</p>
            <p className="text-lg font-bold text-foreground tabular-nums leading-tight">
              R$ {subtotal.toFixed(2)}
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handlePlaceOrder}
            disabled={placing}
            className={cn(
              "px-8 py-3.5 rounded-xl text-sm font-bold transition-all cursor-pointer",
              placing
                ? "bg-muted text-muted-foreground pointer-events-none"
                : "bg-foreground text-background active:scale-[0.97]"
            )}
          >
            {placing ? "Processando..." : "Fazer Pedido"}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

function PaymentOption({
  icon,
  label,
  description,
  selected,
  onSelect,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.98 }}
      onClick={disabled ? undefined : onSelect}
      className={cn(
        "w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left",
        disabled && "opacity-40 pointer-events-none",
        selected
          ? "border-primary/30 bg-primary/5"
          : "border-border/30 bg-card",
        !disabled && "cursor-pointer"
      )}
    >
      <div
        className={cn(
          "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
          selected ? "border-primary" : "border-border/50"
        )}
      >
        {selected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
      </div>
      <div className={cn("text-muted-foreground/50", selected && "text-primary/70")}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground/60">{description}</p>
      </div>
    </motion.button>
  );
}
