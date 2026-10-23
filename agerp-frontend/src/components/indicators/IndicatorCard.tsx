import { useLayoutEffect, useRef, type ReactNode } from 'react';

type IndicatorCardProps = {
    label: string;
    value: string | number;
    icon?: ReactNode;
    iconClassName?: string;
    valueClassName?: string;
    variant?: 'dashboard' | 'primary' | 'secondary';
    testId?: string;
};

/** Mantém o número inteiro visível, mesmo quando o card muda de largura. */
function IndicatorValue({ value, className }: { value: string | number; className: string }) {
    const areaRef = useRef<HTMLParagraphElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    const textoFormatado = typeof value === 'number' ? value.toLocaleString('pt-BR') : value;

    useLayoutEffect(() => {
        const area = areaRef.current;
        const text = textRef.current;
        if (!area || !text) return;

        const ajustarFonte = () => {
            // Restaura a fonte responsiva original antes de medir o texto completo.
            text.style.fontSize = '';
            const larguraDisponivel = area.clientWidth;
            const larguraTexto = text.getBoundingClientRect().width;
            if (larguraDisponivel > 0 && larguraTexto > larguraDisponivel) {
                const tamanhoOriginal = parseFloat(getComputedStyle(text).fontSize);
                // Deixa uma pequena folga para diferenças de arredondamento e zoom.
                text.style.fontSize = `${tamanhoOriginal * (larguraDisponivel - 2) / larguraTexto}px`;
            }
        };

        const observer = new ResizeObserver(ajustarFonte);
        observer.observe(area);
        ajustarFonte();
        // As fontes podem ser carregadas depois do primeiro render.
        void document.fonts?.ready.then(ajustarFonte);
        return () => observer.disconnect();
    }, [value]);

    return <p ref={areaRef} className="mt-2 min-w-0 w-full leading-tight" data-testid="indicator-value-area">
        <span ref={textRef} data-testid="indicator-value" className={`inline-block max-w-none whitespace-nowrap tabular-nums ${className}`}>
            {textoFormatado}
        </span>
    </p>;
}

export function IndicatorCard({ label, value, icon, iconClassName = '', valueClassName = '', variant = 'primary', testId }: IndicatorCardProps) {
    const isDashboard = variant === 'dashboard';
    const valueSize = isDashboard ? 'text-3xl sm:text-4xl font-bold' : variant === 'secondary' ? 'text-xl sm:text-2xl font-semibold' : 'text-2xl sm:text-3xl font-semibold';

    return <article aria-label={label} data-testid={testId ?? 'indicator-card'} className={`min-w-0 bg-white ${isDashboard ? 'rounded-3xl p-5 shadow sm:p-6' : 'rounded-2xl p-5 shadow-sm'}`}>
        <div className="flex min-w-0 items-start justify-between gap-2">
            <p className={isDashboard ? 'min-w-0 text-sm text-gray-500' : 'min-w-0 text-xs uppercase tracking-wide text-gray-500'}>{label}</p>
            {icon && <span aria-hidden="true" className={`shrink-0 text-3xl leading-none sm:text-4xl ${iconClassName}`}>{icon}</span>}
        </div>
        <IndicatorValue value={value} className={`${valueSize} ${valueClassName}`} />
    </article>;
}
