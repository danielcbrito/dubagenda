import type { SVGProps } from "react";

interface NavIconProps extends SVGProps<SVGSVGElement> {
  active?: boolean;
}

const baseProps: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

// cor usada para redesenhar os detalhes internos quando o ícone está ativo
const detailStroke = "hsl(var(--background))";

export function HomeNavIcon({ active = false, ...props }: NavIconProps) {
  const d =
    "M4 10.35c0-.58.25-1.13.69-1.5l6.04-5.11a1.96 1.96 0 0 1 2.54 0l6.04 5.11c.44.37.69.92.69 1.5v7.78A2.87 2.87 0 0 1 17.13 21h-2.18a.95.95 0 0 1-.95-.95v-4.1a1.05 1.05 0 0 0-1.05-1.05h-1.9A1.05 1.05 0 0 0 10 15.95v4.1a.95.95 0 0 1-.95.95H6.87A2.87 2.87 0 0 1 4 18.13v-7.78Z";
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
          <rect width="18" height="18" x="3" y="4" rx="2" fill="currentColor" stroke="currentColor" />
          <path d="M8 2v4" stroke={detailStroke} />
          <path d="M16 2v4" stroke={detailStroke} />
          <path d="M3 10h18" stroke={detailStroke} />
        </>
      ) : (
        <>
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <rect width="18" height="18" x="3" y="4" rx="2" />
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
          <circle cx="12" cy="12" r="10" fill="currentColor" stroke="currentColor" />
          <circle cx="12" cy="10" r="4" stroke={detailStroke} />
          <path d="M18 20a6 6 0 0 0-12 0" stroke={detailStroke} />
        </>
      ) : (
        <>
          <path d="M18 20a6 6 0 0 0-12 0" />
          <circle cx="12" cy="10" r="4" />
          <circle cx="12" cy="12" r="10" />
        </>
      )}
    </svg>
  );
}

/** Sacola (Loja) — mesma silhueta nos dois estados; ativo preenche em vermelho. */
export function BagNavIcon({ active = false, ...props }: NavIconProps) {
  return (
    <svg {...baseProps} {...props}>
      {active ? (
        <>
          <path
            d="M6 2h12l2 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7l2-5Z"
            fill="currentColor"
            stroke="currentColor"
          />
          <path d="M4 7h16" stroke={detailStroke} />
          <path d="M16 11a4 4 0 0 1-8 0" stroke={detailStroke} />
        </>
      ) : (
        <>
          <path d="M6 2h12l2 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7l2-5Z" />
          <path d="M4 7h16" />
          <path d="M16 11a4 4 0 0 1-8 0" />
        </>
      )}
    </svg>
  );
}

/** Carrinho de compras (Loja) — mesma silhueta nos dois estados; ativo preenche em vermelho. */
export function CartNavIcon({ active = false, ...props }: NavIconProps) {
  const body = "M3 4h2.2a1 1 0 0 1 .98.8L6.6 7m0 0 1.5 7.2a2 2 0 0 0 1.96 1.6h7.2a2 2 0 0 0 1.96-1.57L20.6 7H6.6Z";
  return (
    <svg {...baseProps} {...props}>
      {active ? (
        <>
          <path d={body} fill="currentColor" stroke="currentColor" strokeWidth={1.6} />
          <circle cx="10" cy="20" r="1.7" fill="currentColor" stroke="currentColor" strokeWidth={1.2} />
          <circle cx="17.5" cy="20" r="1.7" fill="currentColor" stroke="currentColor" strokeWidth={1.2} />
        </>
      ) : (
        <>
          <path d={body} strokeWidth={1.8} />
          <circle cx="10" cy="20" r="1.7" strokeWidth={1.8} />
          <circle cx="17.5" cy="20" r="1.7" strokeWidth={1.8} />
        </>
      )}
    </svg>
  );
}

/** Coroa premium (Plano) — preenchimento vermelho com joia interna no tom do fundo. */
export function CrownNavIcon({ active = false, ...props }: NavIconProps) {
  const body =
    "M4 17V11L7 14L9.5 7L12 11L14.5 7L17 14L20 11V17H4Z";
  return (
    <svg {...baseProps} {...props}>
      {active ? (
        <>
          <path d={body} fill="currentColor" stroke="currentColor" strokeWidth={1.4} />
          <path d="M4 14.5H20" stroke={detailStroke} strokeWidth={1.3} />
          <circle cx="12" cy="11.5" r="1.3" fill={detailStroke} stroke={detailStroke} strokeWidth={0.8} />
        </>
      ) : (
        <path d={body} strokeWidth={1.6} />
      )}
    </svg>
  );
}

