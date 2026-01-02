import { AdminAPIs } from "@/components/admin/AdminAPIs";

export function TIAPIs() {
  return (
    <div className="space-y-6">
      {/* Header Override */}
      <div className="mb-2">
        <h1 className="text-3xl font-bold tracking-wide text-foreground">
          <span className="text-cyan-400">APIs</span> & Integrações
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure chaves de API e integrações externas
        </p>
      </div>
      
      {/* Reuse existing component without header */}
      <div className="[&>div>div:first-child]:hidden">
        <AdminAPIs />
      </div>
    </div>
  );
}
