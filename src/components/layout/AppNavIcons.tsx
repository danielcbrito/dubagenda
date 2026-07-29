import type { SVGProps } from "react";

interface NavIconProps extends SVGProps<SVGSVGElement> {
  active?: boolean;
}

const baseProps: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

// cor usada para redesenhar os detalhes internos quando o ícone está ativo
const detailStroke = "hsl(var(--background))";

export function HomeNavIcon({ active = false, ...props }: NavIconProps) {
  const d =
    "M3.25 10.15c0-.62.27-1.21.75-1.61l6.38-5.4a2.07 2.07 0 0 1 2.68 0l6.38 5.4c.48.4.75.99.75 1.61v8.53A3.07 3.07 0 0 1 17.12 22h-2.47a1.05 1.05 0 0 1-1.05-1.05v-4.4a1.15 1.15 0 0 0-1.15-1.15h-1.9a1.15 1.15 0 0 0-1.15 1.15v4.4A1.05 1.05 0 0 1 8.35 22H6.88A3.07 3.07 0 0 1 3.25 18.88v-8.53Z";
  return (
    <svg {...baseProps} {...props}>
      {active ? (
        <path d={d} fill="currentColor" fillRule="evenodd" stroke="none" />
      ) : (
        <path d={d} />
      )}
    </svg>
  );
}

export function CalendarNavIcon({ active = false, ...props }: NavIconProps) {
  return (
    <svg {...baseProps} {...props}>
      {active ? (
        <>
          <rect width="18" height="18" x="3" y="4" rx="2.5" fill="currentColor" stroke="currentColor" />
          <path d="M8 2v4" stroke={detailStroke} />
          <path d="M16 2v4" stroke={detailStroke} />
          <path d="M3 10h18" stroke={detailStroke} />
        </>
      ) : (
        <>
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <rect width="18" height="18" x="3" y="4" rx="2.5" />
          <path d="M3 10h18" />
        </>
      )}
    </svg>
  );
}

export function SendNavIcon({ active = false, ...props }: NavIconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path
        d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
      />
      <path d="m21.854 2.147-10.94 10.939" stroke="currentColor" />
    </svg>
  );
}

export function ProfileNavIcon({ active = false, ...props }: NavIconProps) {
  return (
    <svg {...baseProps} {...props}>
      {active ? (
        <>
          <circle cx="12" cy="12" r="10.5" fill="currentColor" stroke="currentColor" />
          <circle cx="12" cy="10" r="4.2" stroke={detailStroke} />
          <path d="M18.2 20.2a6.2 6.2 0 0 0-12.4 0" stroke={detailStroke} />
        </>
      ) : (
        <>
          <path d="M18.2 20.2a6.2 6.2 0 0 0-12.4 0" />
          <circle cx="12" cy="10" r="4.2" />
          <circle cx="12" cy="12" r="10.5" />
        </>
      )}
    </svg>
  );
}

/** Carrinho de compras (Loja) — silhueta mais robusta e espaçada. */
export function CartNavIcon({ active = false, ...props }: NavIconProps) {
  const body = "M2.8 4.2h2.4a1 1 0 0 1 .98.8L7.2 7.4m0 0 1.7 8.2a2.2 2.2 0 0 0 2.16 1.76h7.6a2.2 2.2 0 0 0 2.16-1.73L21.6 7.4H7.2Z";
  return (
    <svg {...baseProps} {...props}>
      {active ? (
        <>
          <path d={body} fill="currentColor" stroke="currentColor" strokeWidth={2.2} />
          <circle cx="10.2" cy="20.5" r="1.9" fill="currentColor" stroke="currentColor" strokeWidth={1.6} />
          <circle cx="18.2" cy="20.5" r="1.9" fill="currentColor" stroke="currentColor" strokeWidth={1.6} />
        </>
      ) : (
        <>
          <path d={body} strokeWidth={2.5} />
          <circle cx="10.2" cy="20.5" r="1.9" strokeWidth={2.5} />
          <circle cx="18.2" cy="20.5" r="1.9" strokeWidth={2.5} />
        </>
      )}
    </svg>
  );
}

/** Tesoura — ícone estratégico, mais robusto e espaçado para Planos de Corte. */
export function PlanNavIcon({ active = false, ...props }: NavIconProps) {
  return (
    <svg {...baseProps} {...props}>
      {active ? (
        <>
          {/* Lâminas cruzadas preenchidas em vermelho */}
          <path d="M7 9.5L17.5 19" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" />
          <path d="M17.5 9.5L7 19" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" />
          {/* Parafuso central */}
          <circle cx="12.25" cy="14.25" r="1.8" fill={detailStroke} stroke={detailStroke} />
          {/* Alça esquerda */}
          <circle cx="6.5" cy="6.5" r="3.3" fill="currentColor" stroke="currentColor" strokeWidth={2.2} />
          <circle cx="6.5" cy="6.5" r="1.8" fill={detailStroke} stroke={detailStroke} />
          {/* Alça direita */}
          <circle cx="18" cy="6.5" r="3.3" fill="currentColor" stroke="currentColor" strokeWidth={2.2} />
          <circle cx="18" cy="6.5" r="1.8" fill={detailStroke} stroke={detailStroke} />
        </>
      ) : (
        <>
          <circle cx="6.5" cy="6.5" r="2.8" />
          <circle cx="18" cy="6.5" r="2.8" />
          <path d="M7 9.5L17.5 19" />
          <path d="M17.5 9.5L7 19" />
          <circle cx="12.25" cy="14.25" r="1.4" />
        </>
      )}
    </svg>
  );
}
