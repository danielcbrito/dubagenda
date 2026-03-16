import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, LocateFixed, MapPin, RefreshCw, Save } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { UnitLocationMiniMap } from "@/components/admin/UnitLocationMiniMap";
import { getDiscoverUnitFullName } from "@/components/discover/discoverUnitUtils";

interface FixableUnit {
  id: string;
  tenant_id: string;
  nome: string;
  rua: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  latitude: number | null;
  longitude: number | null;
  is_sede: boolean;
  tenant: {
    nome: string | null;
    slug: string | null;
  } | null;
}

interface FixResult {
  unitId: string;
  status: "OK" | "NAO_ENCONTRADO" | "ERRO";
  message: string;
  lat?: number;
  lng?: number;
}

const REQUEST_DELAY_MS = 1200;

function buildFullAddress(unit: FixableUnit): string {
  return [unit.rua, unit.numero, unit.bairro, unit.cidade, unit.estado, unit.cep, "Brasil"]
    .map((part) => part?.trim())
    .filter((part): part is string => !!part && part.length > 0)
    .join(", ");
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({
    q: address,
    format: "jsonv2",
    limit: "1",
    countrycodes: "br",
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("Falha ao consultar o geocoding");
  }

  const payload = (await response.json()) as Array<{ lat: string; lon: string }>;
  const match = payload[0];
  if (!match) return null;

  const lat = Number(match.lat);
  const lng = Number(match.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

const AdminFixCoordinates = () => {
  const [units, setUnits] = useState<FixableUnit[]>([]);
  const [draftPositions, setDraftPositions] = useState<Record<string, { lat: number; lng: number } | null>>({});
  const [results, setResults] = useState<Record<string, FixResult>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isFixingAll, setIsFixingAll] = useState(false);
  const [savingIds, setSavingIds] = useState<string[]>([]);
  const [authorized, setAuthorized] = useState(false);

  const loadUnits = useCallback(async () => {
    setIsLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setAuthorized(false);
      setUnits([]);
      setDraftPositions({});
      setIsLoading(false);
      return;
    }

    const [{ data: isAdmin }, { data: ownedTenantId }] = await Promise.all([
      supabase.rpc("is_admin"),
      supabase.rpc("get_user_tenant_id"),
    ]);

    const tenantIds = ownedTenantId ? [ownedTenantId] : [];
    const canAccess = Boolean(isAdmin) || tenantIds.length > 0;
    setAuthorized(canAccess);

    if (!canAccess) {
      setUnits([]);
      setDraftPositions({});
      setIsLoading(false);
      return;
    }

    let query = supabase
      .from("tenant_unidades")
      .select(`
        id,
        tenant_id,
        nome,
        rua,
        numero,
        bairro,
        cidade,
        estado,
        cep,
        latitude,
        longitude,
        is_sede,
        tenant:tenants!tenant_id (nome, slug)
      `)
      .eq("ativo", true)
      .order("tenant_id")
      .order("is_sede", { ascending: false })
      .order("nome");

    if (!isAdmin) {
      query = query.in("tenant_id", tenantIds);
    }

    const { data, error } = await query;

    if (error) {
      toast.error("Não foi possível carregar as unidades.");
      setUnits([]);
      setDraftPositions({});
      setIsLoading(false);
      return;
    }

    const unitList = (data ?? []) as unknown as FixableUnit[];
    setUnits(unitList);
    setDraftPositions(
      Object.fromEntries(
        unitList.map((unit) => [
          unit.id,
          unit.latitude !== null && unit.longitude !== null
            ? { lat: unit.latitude, lng: unit.longitude }
            : null,
        ])
      )
    );
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadUnits();
  }, [loadUnits]);

  const saveUnitCoordinates = useCallback(async (unit: FixableUnit, coords: { lat: number; lng: number }) => {
    setSavingIds((current) => [...current, unit.id]);

    const { error } = await supabase
      .from("tenant_unidades")
      .update({ latitude: coords.lat, longitude: coords.lng })
      .eq("id", unit.id);

    setSavingIds((current) => current.filter((id) => id !== unit.id));

    if (error) {
      setResults((current) => ({
        ...current,
        [unit.id]: {
          unitId: unit.id,
          status: "ERRO",
          message: error.message,
        },
      }));
      toast.error(`Não foi possível salvar ${unit.nome}.`);
      return false;
    }

    setUnits((current) =>
      current.map((entry) =>
        entry.id === unit.id
          ? { ...entry, latitude: coords.lat, longitude: coords.lng }
          : entry
      )
    );
    setResults((current) => ({
      ...current,
      [unit.id]: {
        unitId: unit.id,
        status: "OK",
        message: "Coordenadas salvas com sucesso",
        lat: coords.lat,
        lng: coords.lng,
      },
    }));
    toast.success(`Localização salva para ${unit.nome}.`);
    return true;
  }, []);

  const handleFixOne = useCallback(async (unit: FixableUnit) => {
    const address = buildFullAddress(unit);
    if (!address) {
      setResults((current) => ({
        ...current,
        [unit.id]: {
          unitId: unit.id,
          status: "ERRO",
          message: "Endereço incompleto para geocoding",
        },
      }));
      return;
    }

    try {
      const nextCoords = await geocodeAddress(address);
      if (!nextCoords) {
        setResults((current) => ({
          ...current,
          [unit.id]: {
            unitId: unit.id,
            status: "NAO_ENCONTRADO",
            message: "Nominatim não encontrou este endereço",
          },
        }));
        return false;
      }

      setDraftPositions((current) => ({ ...current, [unit.id]: nextCoords }));
      return saveUnitCoordinates(unit, nextCoords);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      setResults((current) => ({
        ...current,
        [unit.id]: {
          unitId: unit.id,
          status: "ERRO",
          message,
        },
      }));
      return false;
    }
  }, [saveUnitCoordinates]);

  const handleFixAll = useCallback(async () => {
    setIsFixingAll(true);

    for (const unit of units) {
      await handleFixOne(unit);
      await wait(REQUEST_DELAY_MS);
    }

    setIsFixingAll(false);
    toast.success("Reprocessamento concluído.");
  }, [handleFixOne, units]);

  const resultList = useMemo(() => Object.values(results), [results]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-10 pt-[calc(env(safe-area-inset-top)+1rem)] md:px-6">
        <div className="rounded-[28px] border border-border bg-card p-5 shadow-sm shadow-foreground/5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Admin temporário
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Corrigir coordenadas das unidades
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Reprocessa o geocoding com endereço completo, mostra cada unidade separadamente e permite arrastar o pin para o ponto exato.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void handleFixAll()}
              disabled={isLoading || isFixingAll || !authorized || units.length === 0}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-foreground px-4 text-sm font-semibold text-background transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isFixingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {isFixingAll ? "Processando todas..." : "Corrigir todas"}
            </button>
          </div>
        </div>

        {!authorized && !isLoading ? (
          <div className="rounded-[24px] border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm shadow-foreground/5">
            Você precisa entrar com um usuário admin ou dono da barbearia para editar coordenadas.
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-[24px] border border-border bg-card p-8 shadow-sm shadow-foreground/5">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando unidades...
            </div>
          </div>
        ) : null}

        {!isLoading && authorized ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              {units.map((unit, index) => {
                const title = getDiscoverUnitFullName(unit.tenant?.nome || unit.nome, unit.nome);
                const fullAddress = buildFullAddress(unit);
                const draftPosition = draftPositions[unit.id];
                const result = results[unit.id];
                const isSaving = savingIds.includes(unit.id);

                return (
                  <motion.div
                    key={unit.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03, duration: 0.22 }}
                    className="rounded-[24px] border border-border bg-card p-4 shadow-sm shadow-foreground/5"
                  >
                    <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-semibold text-foreground">{title}</h2>
                          {unit.is_sede ? (
                            <span className="rounded-full border border-border bg-secondary/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-foreground">
                              Sede
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                          <div>
                            <p>{fullAddress || "Endereço incompleto"}</p>
                            <p className="mt-1 font-mono text-[11px] text-muted-foreground/80">
                              {draftPosition
                                ? `${draftPosition.lat.toFixed(6)}, ${draftPosition.lng.toFixed(6)}`
                                : "Sem coordenadas salvas"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="mb-3 text-[12px] font-medium text-muted-foreground">
                      Arraste o pin para ajustar a localização exata ou clique no mapa para reposicionar.
                    </p>

                    <UnitLocationMiniMap
                      position={draftPosition}
                      onChange={(nextPosition) => {
                        setDraftPositions((current) => ({
                          ...current,
                          [unit.id]: nextPosition,
                        }));
                      }}
                    />

                    <div className="mt-4 flex flex-col gap-2 md:flex-row">
                      <button
                        type="button"
                        onClick={() => void handleFixOne(unit)}
                        disabled={isFixingAll || isSaving}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-semibold text-foreground transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <LocateFixed className="h-4 w-4" />
                        Reprocessar endereço
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const nextPosition = draftPosition;
                          if (!nextPosition) {
                            toast.error("Escolha uma posição no mapa antes de salvar.");
                            return;
                          }
                          void saveUnitCoordinates(unit, nextPosition);
                        }}
                        disabled={isFixingAll || isSaving || !draftPosition}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-foreground px-4 text-sm font-semibold text-background transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Salvar localização
                      </button>
                    </div>

                    {result ? (
                      <div
                        className={`mt-3 rounded-2xl border px-3 py-2 text-sm ${
                          result.status === "OK"
                            ? "border-border bg-secondary/15 text-foreground"
                            : "border-border bg-destructive/10 text-foreground"
                        }`}
                      >
                        <p className="font-semibold">{result.status === "OK" ? "Atualizado" : result.status === "NAO_ENCONTRADO" ? "Não encontrado" : "Erro"}</p>
                        <p className="text-muted-foreground">{result.message}</p>
                      </div>
                    ) : null}
                  </motion.div>
                );
              })}
            </div>

            <aside className="space-y-4">
              <div className="rounded-[24px] border border-border bg-card p-5 shadow-sm shadow-foreground/5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  Resumo
                </p>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <p>{units.length} unidade(s) carregadas.</p>
                  <p>{resultList.filter((result) => result.status === "OK").length} corrigida(s).</p>
                  <p>{resultList.filter((result) => result.status === "NAO_ENCONTRADO").length} não encontrada(s).</p>
                  <p>{resultList.filter((result) => result.status === "ERRO").length} com erro.</p>
                </div>
              </div>

              <div className="rounded-[24px] border border-border bg-card p-5 shadow-sm shadow-foreground/5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  Como usar
                </p>
                <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>1. Clique em <strong className="text-foreground">Corrigir todas</strong> para reprocessar o geocoding.</li>
                  <li>2. Confira as unidades que ainda ficaram erradas.</li>
                  <li>3. Arraste o pin e clique em <strong className="text-foreground">Salvar localização</strong>.</li>
                </ol>
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default AdminFixCoordinates;
