import { Routes, Route, Navigate } from "react-router-dom";
import { AdminPlanos } from "./AdminPlanos";
import { AdminCortes } from "./AdminCortes";

export function AdminServicos() {
  return (
    <Routes>
      <Route index element={<Navigate to="planos" replace />} />
      <Route path="planos" element={<AdminPlanos />} />
      <Route path="cortes" element={<AdminCortes />} />
    </Routes>
  );
}
