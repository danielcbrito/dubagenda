import { AdminSeguranca } from "@/components/admin/AdminSeguranca";

export function TISeguranca() {
  return (
    <div className="space-y-6">
      {/* Header Override */}
      <div className="mb-2">
        <h1 className="text-3xl font-bold tracking-wide text-foreground">
          <span className="text-cyan-400">Segurança</span> do Sistema
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie senhas, sessões e logs de acesso
        </p>
      </div>
      
      {/* Reuse existing component without header */}
      <div className="[&>div>div:first-child]:hidden">
        <AdminSeguranca />
      </div>
    </div>
  );
}
