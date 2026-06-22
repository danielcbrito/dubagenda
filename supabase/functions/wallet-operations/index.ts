import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FUNCTION_VERSION = "wallet-refund-origin-account-2026-06-22T2355Z";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Token de autenticação ausente" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(token);
    if (authError || !user) {
      console.error("[wallet-operations] Auth error:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { action } = body;

    console.log(`[wallet-operations] version=${FUNCTION_VERSION} action=${action} user=${user.id}`);

    // ─── GET BALANCE ───
    if (action === "get_balance") {
      const { data: balance } = await supabase
        .rpc("get_or_create_wallet_balance", { p_user_id: user.id });

      // Also get credits balance
      const { data: creditsBalance } = await supabase
        .rpc("get_user_available_credits", { p_user_id: user.id });

      return new Response(
        JSON.stringify({ balance: balance || 0, creditsBalance: creditsBalance || 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── GET TRANSACTIONS ───
    if (action === "get_transactions") {
      const { data: transactions, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      return new Response(
        JSON.stringify({ transactions: transactions || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── RECHARGE (PIX) ───
    if (action === "recharge") {
      const { amount } = body;
      if (!amount || amount < 1) {
        return new Response(
          JSON.stringify({ error: "Valor mínimo para recarga é R$ 1,00" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (amount > 5000) {
        return new Response(
          JSON.stringify({ error: "Valor máximo para recarga é R$ 5.000,00" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!asaasApiKey) {
        return new Response(
          JSON.stringify({ error: "Gateway de pagamento não configurado" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const isSandbox = asaasApiKey.includes("hmlg");
      const baseUrl = isSandbox ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3";

      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome, cpf, telefone, cep")
        .eq("id", user.id)
        .single();

      if (!profile?.cpf) {
        return new Response(
          JSON.stringify({ error: "CPF é obrigatório para recargas. Atualize seu perfil." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find or create Asaas customer
      const searchRes = await fetch(`${baseUrl}/customers?externalReference=${user.id}`, {
        headers: { "access_token": asaasApiKey },
      });
      const searchData = await searchRes.json();
      let customerId: string;

      if (searchData.data && searchData.data.length > 0) {
        customerId = searchData.data[0].id;
      } else {
        const createRes = await fetch(`${baseUrl}/customers`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "access_token": asaasApiKey },
          body: JSON.stringify({
            name: profile.nome,
            cpfCnpj: profile.cpf.replace(/\D/g, ""),
            email: user.email,
            externalReference: user.id,
          }),
        });
        const createData = await createRes.json();
        if (!createData.id) {
          console.error("Failed to create Asaas customer:", createData);
          return new Response(
            JSON.stringify({ error: "Erro ao criar cliente no gateway" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        customerId = createData.id;
      }

      // Create PIX payment
      const dueDate = new Date().toISOString().split("T")[0];
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30min

      const paymentRes = await fetch(`${baseUrl}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "access_token": asaasApiKey },
        body: JSON.stringify({
          customer: customerId,
          billingType: "PIX",
          value: amount,
          dueDate,
          description: `Recarga de carteira - R$ ${amount.toFixed(2)}`,
          externalReference: `wallet_recharge_${user.id}`,
        }),
      });

      const paymentData = await paymentRes.json();
      if (!paymentData.id) {
        console.error("Failed to create payment:", paymentData);
        return new Response(
          JSON.stringify({ error: "Erro ao gerar cobrança PIX" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get PIX QR Code
      const pixRes = await fetch(`${baseUrl}/payments/${paymentData.id}/pixQrCode`, {
        headers: { "access_token": asaasApiKey },
      });
      const pixData = await pixRes.json();

      // Create transaction record
      const { data: transaction, error: txError } = await supabase
        .from("wallet_transactions")
        .insert({
          user_id: user.id,
          type: "recharge",
          amount,
          status: "pending",
          description: `Recarga via PIX`,
          gateway_payment_id: paymentData.id,
          pix_qr_code: pixData.encodedImage || null,
          pix_payload: pixData.payload || null,
          pix_expires_at: expiresAt,
        })
        .select()
        .single();

      if (txError) {
        console.error("Error creating transaction:", txError);
      }

      return new Response(
        JSON.stringify({
          transactionId: transaction?.id,
          gatewayPaymentId: paymentData.id,
          pixQrCode: pixData.encodedImage,
          pixPayload: pixData.payload,
          expiresAt,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── CONVERT CREDITS TO WALLET BALANCE ───
    if (action === "convert_credits") {
      const { amount } = body;

      // Get available credits
      const { data: availableCredits } = await supabase
        .rpc("get_user_available_credits", { p_user_id: user.id });

      if (!availableCredits || availableCredits < amount || amount <= 0) {
        return new Response(
          JSON.stringify({ error: "Saldo de créditos insuficiente" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get unused credits to mark as used (FIFO)
      const { data: unusedCredits } = await supabase
        .from("creditos")
        .select("id, valor")
        .eq("user_id", user.id)
        .eq("usado", false)
        .or("expires_at.is.null,expires_at.gt.now()")
        .order("created_at", { ascending: true });

      if (!unusedCredits || unusedCredits.length === 0) {
        return new Response(
          JSON.stringify({ error: "Nenhum crédito disponível para conversão" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mark credits as used (FIFO) until we reach the amount
      let remaining = amount;
      for (const credit of unusedCredits) {
        if (remaining <= 0) break;
        await supabase
          .from("creditos")
          .update({ usado: true })
          .eq("id", credit.id);
        remaining -= credit.valor;
      }

      const actualConverted = amount - Math.max(0, remaining);

      // Add to wallet balance
      const { data: currentBalance } = await supabase
        .rpc("get_or_create_wallet_balance", { p_user_id: user.id });

      await supabase
        .from("wallet_balances")
        .update({ balance: (currentBalance || 0) + actualConverted })
        .eq("user_id", user.id);

      // Create transaction record
      await supabase
        .from("wallet_transactions")
        .insert({
          user_id: user.id,
          type: "convert_credits",
          amount: actualConverted,
          status: "completed",
          description: `Conversão de R$ ${actualConverted.toFixed(2)} em créditos para saldo`,
        });

      return new Response(
        JSON.stringify({
          success: true,
          convertedAmount: actualConverted,
          newBalance: (currentBalance || 0) + actualConverted,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── WITHDRAW (Pix via Woovi, taxa REAL dinâmica por cancelamento) ───
    if (action === "withdraw") {
      console.log(`[wallet-operations] withdraw_refund_mode=origin_account_no_pix_key version=${FUNCTION_VERSION}`);
      const { confirmed } = body;
      const isPreview = confirmed !== true;

      const { data: completedWithdraws } = await supabase
        .from("wallet_transactions")
        .select("metadata")
        .eq("user_id", user.id)
        .eq("type", "withdraw")
        .eq("status", "completed");

      const alreadyWithdrawnCreditIds = new Set<string>();
      for (const tx of completedWithdraws || []) {
        const ids = Array.isArray(tx.metadata?.source_credit_ids) ? tx.metadata.source_credit_ids : [];
        for (const id of ids) {
          if (typeof id === "string") alreadyWithdrawnCreditIds.add(id);
        }
      }

      // Créditos pendentes de cancelamento Pix. O metadata antigo pode não ter endToEndId;
      // nesses casos a cobrança local da Woovi é a fonte da verdade pelo correlation_id.
      const { data: rawCredits } = await supabase
        .from("wallet_transactions")
        .select("id, amount, description, created_at, metadata")
        .eq("user_id", user.id)
        .eq("type", "refund")
        .eq("status", "completed")
        .not("metadata->>woovi_correlation_id", "is", null)
        .order("created_at", { ascending: true });

      const baseCredits = (rawCredits || []).filter((c: any) => !alreadyWithdrawnCreditIds.has(c.id));

      // Enriquecimento: busca taxa REAL Woovi (raw_response.pix.charge.fee)
      const correlationIds = baseCredits
        .map((c: any) => c.metadata?.woovi_correlation_id)
        .filter((v: any) => typeof v === "string" && v.length > 0);

      const chargesByCorr: Record<string, any> = {};
      if (correlationIds.length) {
        const { data: charges } = await supabase
          .from("woovi_charges")
          .select("correlation_id, value_centavos, raw_response")
          .in("correlation_id", correlationIds);
        for (const ch of charges || []) chargesByCorr[ch.correlation_id] = ch;
      }

      // Saldo real disponível na carteira limita o reembolso máximo
      const { data: balRowPreview } = await supabase
        .from("wallet_balances")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();
      let remainingBalanceCents = Math.max(0, Math.round(Number(balRowPreview?.balance || 0) * 100));

      const enriched = baseCredits.map((c: any) => {
        const meta = c.metadata || {};
        const charge = chargesByCorr[meta.woovi_correlation_id] || null;
        const raw = charge?.raw_response || null;
        const endToEndId =
          raw?.pix?.endToEndId ?? raw?.endToEndId ?? raw?.charge?.endToEndId ?? meta.woovi_endToEndId ?? null;
        const originalPaidCents = Number(charge?.value_centavos ?? meta.woovi_value_centavos ?? Math.round(Number(c.amount) * 100));
        const feeCents = Number(raw?.pix?.charge?.fee ?? raw?.charge?.fee ?? raw?.fee ?? 0);

        // Limita o valor refundável ao saldo restante da carteira
        const paidCents = Math.min(originalPaidCents, remainingBalanceCents);
        remainingBalanceCents = Math.max(0, remainingBalanceCents - paidCents);
        const netCents = Math.max(0, paidCents - feeCents);
        return { credit: c, endToEndId, paidCents, feeCents, netCents, originalPaidCents };
      }).filter((e: any) => e.paidCents > 0 && e.netCents > 0);

      const grossCents = enriched.reduce((s, e) => s + e.paidCents, 0);
      const feeCents = enriched.reduce((s, e) => s + e.feeCents, 0);
      const netCents = enriched.reduce((s, e) => s + e.netCents, 0);

      const previewPayload = {
        preview: true,
        credits: enriched.map((e) => ({
          id: e.credit.id,
          description: e.credit.description,
          created_at: e.credit.created_at,
          amount: e.paidCents / 100,
          fee: e.feeCents / 100,
          net: e.netCents / 100,
        })),
        creditsCount: enriched.length,
        grossAmount: grossCents / 100,
        totalFee: feeCents / 100,
        netAmount: netCents / 100,
        message: `Você vai receber R$ ${(netCents / 100).toFixed(2)} via Pix. Taxa real Woovi: R$ ${(feeCents / 100).toFixed(2)}.`,
      };

      if (isPreview) {
        return new Response(JSON.stringify(previewPayload), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // EXECUTE
      if (enriched.length === 0 || netCents <= 0) {
        return new Response(JSON.stringify({ error: "Sem saldo disponível para reembolso." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const missing = enriched.find((e) => !e.endToEndId);
      if (missing) {
        return new Response(JSON.stringify({ error: "Crédito sem dados Woovi para reembolso. Contate o suporte." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const wooviAppId = Deno.env.get("ID_DO_APLICATIVO_WOOVI");
      if (!wooviAppId) {
        return new Response(JSON.stringify({ error: "Gateway Woovi não configurado." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const successes: { id: string; correlationID: string }[] = [];
      for (const e of enriched) {
        const correlationID = `wallet-refund-${e.credit.id}-${Date.now()}`;
        let resp: Response;
        try {
          resp = await fetch("https://api.woovi.com/api/v1/refund", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: wooviAppId },
            body: JSON.stringify({
              correlationID,
              transactionEndToEndId: e.endToEndId,
              value: e.netCents,
            }),
          });
        } catch (err) {
          console.error("[wallet-operations] Woovi network error", err);
          return new Response(JSON.stringify({ error: "Falha de rede ao processar reembolso. Tente novamente." }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          console.error(`[wallet-operations] Woovi error credit=${e.credit.id}`, resp.status, data);
          return new Response(
            JSON.stringify({
              error: `Woovi retornou ${resp.status}. Nenhum reembolso processado.`,
              details: data,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        successes.push({ id: e.credit.id, correlationID });
      }

      // Tudo OK — marca créditos consumidos e debita saldo
      const ids = successes.map((s) => s.id);
      await supabase.from("wallet_transactions").update({ status: "consumed" }).in("id", ids);

      const { data: balRow } = await supabase
        .from("wallet_balances")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();
      const grossReais = grossCents / 100;
      const newBalance = Math.max(0, Number((Number(balRow?.balance || 0) - grossReais).toFixed(2)));
      await supabase.from("wallet_balances").update({ balance: newBalance }).eq("user_id", user.id);

      await supabase.from("wallet_transactions").insert({
        user_id: user.id,
        type: "withdraw",
        amount: grossReais,
        status: "completed",
        description: `Reembolso PIX - ${successes.length} cancelamento(s), líquido R$ ${(netCents / 100).toFixed(2)} (taxa R$ ${(feeCents / 100).toFixed(2)})`,
        destination_pix_key: null,
        metadata: {
          credits_count: successes.length,
          gross_amount: grossReais,
          total_fee: feeCents / 100,
          net_amount: netCents / 100,
          source_credit_ids: ids,
          woovi_correlations: successes.map((s) => s.correlationID),
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          creditsProcessed: successes.length,
          grossAmount: grossReais,
          totalFee: feeCents / 100,
          netAmount: netCents / 100,
          message: `Reembolso de R$ ${(netCents / 100).toFixed(2)} devolvido para a conta de origem do Pix.`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


    // ─── TRANSFER ───
    if (action === "transfer") {
      const { amount, pixKey, recipientName } = body;

      if (!amount || amount < 1) {
        return new Response(
          JSON.stringify({ error: "Valor mínimo para transferência é R$ 1,00" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!pixKey || typeof pixKey !== "string" || pixKey.trim().length < 5) {
        return new Response(
          JSON.stringify({ error: "Chave PIX do destinatário inválida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: currentBalance } = await supabase
        .rpc("get_or_create_wallet_balance", { p_user_id: user.id });

      if (!currentBalance || currentBalance < amount) {
        return new Response(
          JSON.stringify({ error: "Saldo insuficiente" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Debit
      await supabase
        .from("wallet_balances")
        .update({ balance: currentBalance - amount })
        .eq("user_id", user.id);

      // Create pending transaction
      await supabase
        .from("wallet_transactions")
        .insert({
          user_id: user.id,
          type: "transfer",
          amount,
          status: "pending",
          description: `Transferência para ${recipientName || "destinatário"}`,
          destination_pix_key: pixKey.trim(),
          destination_name: recipientName || null,
        });

      return new Response(
        JSON.stringify({
          success: true,
          message: "Transferência solicitada. Será processada em até 24h.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── CHECK RECHARGE STATUS ───
    if (action === "check_recharge_status") {
      const { transactionId } = body;

      const { data: tx } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("id", transactionId)
        .eq("user_id", user.id)
        .single();

      if (!tx) {
        return new Response(
          JSON.stringify({ error: "Transação não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (tx.status === "completed") {
        return new Response(
          JSON.stringify({ status: "completed" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check Asaas payment status
      if (tx.gateway_payment_id && asaasApiKey) {
        const isSandbox = asaasApiKey.includes("hmlg");
        const baseUrl = isSandbox ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3";

        const paymentRes = await fetch(`${baseUrl}/payments/${tx.gateway_payment_id}`, {
          headers: { "access_token": asaasApiKey },
        });
        const paymentData = await paymentRes.json();

        if (paymentData.status === "RECEIVED" || paymentData.status === "CONFIRMED") {
          // Payment confirmed - credit wallet
          const { data: currentBalance } = await supabase
            .rpc("get_or_create_wallet_balance", { p_user_id: user.id });

          await supabase
            .from("wallet_balances")
            .update({ balance: (currentBalance || 0) + tx.amount })
            .eq("user_id", user.id);

          await supabase
            .from("wallet_transactions")
            .update({ status: "completed" })
            .eq("id", tx.id);

          return new Response(
            JSON.stringify({ status: "completed" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(
        JSON.stringify({ status: tx.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── PAY SERVICE (wallet debit for appointment) ───
    if (action === "pay_service") {
      const { amount, appointmentId } = body;

      if (!amount || amount <= 0) {
        return new Response(
          JSON.stringify({ error: "Valor inválido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!appointmentId) {
        return new Response(
          JSON.stringify({ error: "ID do agendamento é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: currentBalance } = await supabase
        .rpc("get_or_create_wallet_balance", { p_user_id: user.id });

      if (!currentBalance || currentBalance < amount) {
        return new Response(
          JSON.stringify({ error: "Saldo insuficiente na carteira" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Debit from wallet
      await supabase
        .from("wallet_balances")
        .update({ balance: currentBalance - amount })
        .eq("user_id", user.id);

      // Create transaction record
      await supabase
        .from("wallet_transactions")
        .insert({
          user_id: user.id,
          type: "payment",
          amount,
          status: "completed",
          description: `Pagamento de serviço via carteira - R$ ${amount.toFixed(2)}`,
        });

      return new Response(
        JSON.stringify({
          success: true,
          newBalance: currentBalance - amount,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação não reconhecida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[wallet-operations] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
