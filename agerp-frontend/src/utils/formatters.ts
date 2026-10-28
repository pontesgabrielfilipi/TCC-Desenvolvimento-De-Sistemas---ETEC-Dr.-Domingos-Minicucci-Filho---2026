export function formatCurrency(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') {
        return 'R$ 0,00';
    }

    const num = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(num)) {
        return 'R$ 0,00';
    }

    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(num);
}

export function formatDate(dateString: string | null | undefined): string {
    if (!dateString) return '-';
    try {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('pt-BR');
    } catch {
        return '-';
    }
}

export function formatDateTime(dateString: string | null | undefined): string {
    if (!dateString) return '-';
    try {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return '-';
    }
}
