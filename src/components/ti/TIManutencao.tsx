import { AdminManutencao } from "@/components/admin/AdminManutencao";

export function TIManutencao() {
  return (
    <div className="space-y-6">
      {/* Header Override */}
      <div className="mb-2">
        <h1 className="text-3xl font-bold tracking-wide text-foreground">
          <span className="text-cyan-400">Modo</span> Manutenção
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie o modo de manutenção do sistema
        </p>
      </div>
      
      <AdminManutencao />
    </div>
  );
}
