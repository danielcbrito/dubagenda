import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import pixIconCheckout from "@/assets/pix-icon-checkout.png";
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
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <Check className="w-6 h-6 text-emerald-500" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Pedido Confirmado</h2>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-[260px]">
            {paymentMethod === "barbearia"
              ? "Retire e pague seu pedido diretamente na barbearia."
              : "Aguardando confirmação de pagamento."}
          </p>
          <div className="px-4 py-2.5 rounded-lg bg-card border border-border/30">
            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">Nº do Pedido</p>
            <p className="text-sm font-bold text-foreground tabular-nums">{orderNumber}</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleClose}
            className="mt-4 px-8 py-3 rounded-xl text-sm font-bold bg-foreground text-background cursor-pointer"
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

      <div className="h-px bg-border/20" />

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-32">
        {/* Store */}
        <div className="px-5 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-muted/20 flex items-center justify-center">
            <span className="text-[11px] font-bold text-muted-foreground">
              {tenantNome.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{tenantNome}</p>
            <p className="text-[10px] text-muted-foreground/50">Loja</p>
          </div>
        </div>

        <div className="h-px bg-border/10 mx-5" />

        {/* Items */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest">
            Produtos ({totalQty})
          </p>
          {selectedItems.map((item) => {
            const price =
              item.preco_promocional != null && item.preco_promocional < item.preco
                ? item.preco_promocional
                : item.preco;
            return (
              <div key={item.id} className="flex gap-3 items-center">
                <div className="w-12 h-12 rounded-lg bg-muted/15 overflow-hidden flex-shrink-0 border border-border/15">
                  {item.imagem_url ? (
                    <img src={item.imagem_url} alt={item.nome} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-4 h-4 text-muted-foreground/10" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground line-clamp-1">{item.nome}</p>
                  <p className="text-sm font-bold text-foreground tabular-nums mt-0.5">
                    R$ {price.toFixed(2)}
                  </p>
                </div>
                <span className="text-[11px] text-muted-foreground/40 flex-shrink-0 tabular-nums">x{item.quantidade}</span>
              </div>
            );
          })}
        </div>

        <div className="h-px bg-border/10 mx-5" />

        {/* Delivery */}
        <div className="px-5 py-4 space-y-2.5">
          <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest">
            Entrega
          </p>
          <div className="flex items-center gap-3 py-2">
            <div className="w-4 h-4 rounded-full border-[1.5px] border-foreground flex items-center justify-center flex-shrink-0">
              <div className="w-2 h-2 rounded-full bg-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Retirar na Barbearia</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Retire diretamente no local</p>
            </div>
          </div>
        </div>

        <div className="h-px bg-border/10 mx-5" />

        {/* Payment */}
        <div className="px-5 py-4 space-y-2.5">
          <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest">
            Pagamento
          </p>
          <div className="space-y-1.5">
            <PaymentRow
              label="Pagar na Barbearia"
              sublabel="Pague ao retirar"
              selected={paymentMethod === "barbearia"}
              onSelect={() => setPaymentMethod("barbearia")}
            />
            <PaymentRow
              label="Pix"
              sublabel="Em breve"
              selected={false}
              onSelect={() => {}}
              disabled
              icon={<img src={pixIconCheckout} alt="Pix" className="w-5 h-5 object-contain" />}
            />
            <PaymentRow
              label="Cartão de Crédito"
              sublabel="Em breve"
              selected={false}
              onSelect={() => {}}
              disabled
            />
          </div>
        </div>

        <div className="h-px bg-border/10 mx-5" />

        {/* Summary */}
        <div className="px-5 py-4 space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest">
            Resumo
          </p>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground/60">
              Subtotal ({totalQty} {totalQty === 1 ? "item" : "itens"})
            </span>
            <span className="text-xs text-foreground tabular-nums">R$ {subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground/60">Retirada</span>
            <span className="text-xs font-semibold text-emerald-500">Grátis</span>
          </div>
          <div className="h-px bg-border/15 my-1" />
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-foreground">Total</span>
            <span className="text-base font-bold text-foreground tabular-nums">R$ {subtotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div
        className="flex-shrink-0 bg-background border-t border-border/20 px-5 pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[9px] text-muted-foreground/40 uppercase tracking-widest font-medium">Total</p>
            <p className="text-lg font-bold text-foreground tabular-nums leading-tight">
              R$ {subtotal.toFixed(2)}
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handlePlaceOrder}
            disabled={placing}
            className={cn(
              "px-8 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer",
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

function PaymentRow({
  label,
  sublabel,
  selected,
  onSelect,
  disabled = false,
}: {
  label: string;
  sublabel: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-3 py-3 px-3.5 rounded-lg text-left transition-colors",
        disabled && "opacity-35 pointer-events-none",
        selected ? "bg-muted/30" : "bg-transparent",
        !disabled && "cursor-pointer active:bg-muted/20"
      )}
    >
      <div
        className={cn(
          "w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0 transition-colors",
          selected ? "border-foreground" : "border-muted-foreground/30"
        )}
      >
        {selected && <div className="w-2 h-2 rounded-full bg-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground/45 mt-0.5">{sublabel}</p>
      </div>
    </button>
  );
}
