// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { navigationItems } from './navigationItems';
import { useAparenciaSistema } from '../../hooks/useAparenciaSistema';
import { MobileHeaderActionContext } from './MobileHeaderActionContext';

export function AuthenticatedLayout() {
    const { user, logout } = useAuth();
    const { nomeEmpresa } = useAparenciaSistema();
    const [open, setOpen] = useState(false);
    const [mobileHeaderActionTarget, setMobileHeaderActionTarget] = useState<HTMLDivElement | null>(null);
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const mobileSidebarRef = useRef<HTMLElement>(null);
    const hadMenuOpen = useRef(false);
    const location = useLocation();
    // O menu lateral fica recolhido até lg, mas o cabeçalho compacto é exclusivo de celular (< sm).
    const mobilePageTitle: Record<string, { icon: string; text: string }> = {
        '/dashboard': { icon: '', text: 'Dashboard' },
        '/clientes': { icon: '👥', text: 'Clientes' },
        '/produtos': { icon: '📦', text: 'Produtos' },
        '/pedidos': { icon: '📋', text: 'Pedidos' },
        '/admin': { icon: '🔧', text: 'Painel Administrativo' },
    };
    const activeTitle = mobilePageTitle[location.pathname];
    useEffect(() => {
        if (!open) {
            if (hadMenuOpen.current) menuButtonRef.current?.focus();
            hadMenuOpen.current = false;
            return;
        }
        hadMenuOpen.current = true;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        mobileSidebarRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
            if (event.key !== 'Tab') return;
            const focusables = Array.from(mobileSidebarRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []);
            if (!focusables.length) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);
    useEffect(() => {
        const closeTimer = window.setTimeout(() => setOpen(false), 0);
        return () => window.clearTimeout(closeTimer);
    }, [location.pathname]);
    useEffect(() => {
        const desktop = window.matchMedia('(min-width: 1024px)');
        const closeOnDesktop = () => {
            if (desktop.matches) setOpen(false);
        };
        const observer = new ResizeObserver(closeOnDesktop);
        observer.observe(document.documentElement);
        desktop.addEventListener('change', closeOnDesktop);
        window.addEventListener('resize', closeOnDesktop);
        window.visualViewport?.addEventListener('resize', closeOnDesktop);
        return () => {
            observer.disconnect();
            desktop.removeEventListener('change', closeOnDesktop);
            window.removeEventListener('resize', closeOnDesktop);
            window.visualViewport?.removeEventListener('resize', closeOnDesktop);
        };
    }, []);

    const sidebar = (
        <div className="flex h-full flex-col bg-slate-900 text-white">
            <div className="flex items-center justify-between border-b border-slate-800 p-6">
                <div className="min-w-0"><h1 className="brand break-words text-2xl font-bold tracking-tight" title={nomeEmpresa}>{nomeEmpresa}</h1><p className="mt-1 text-xs text-slate-400">Gestão Empresarial</p></div>
                <button type="button" onClick={() => setOpen(false)} aria-label="Fechar menu" className="rounded-lg p-2 hover:bg-slate-800 lg:hidden"><X aria-hidden="true" size={22} /></button>
            </div>
            <nav aria-label="Navegação principal" className="flex-1 space-y-1 overflow-y-auto p-4">
                {navigationItems.filter(item => user?.paginas?.includes(item.page) && (!item.profiles || item.profiles.includes(user?.perfilNome ?? ''))).map(item => {
                    const Icon = item.icon;
                    return <NavLink key={item.path} to={item.path} end aria-label={item.label} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium no-underline transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                        <Icon size={20} aria-hidden="true" /><span>{item.label}</span>
                    </NavLink>;
                })}
            </nav>
            <div className="border-t border-slate-800 p-4">
                <div className="flex items-center gap-3 px-3 py-2">
                    <div aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 font-bold">{(user?.nome || user?.email || 'U')[0].toUpperCase()}</div>
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{user?.nome || user?.email}</p><p className="truncate text-xs text-slate-400">{user?.email}</p></div>
                </div>
                <button type="button" onClick={() => void logout()} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-red-300 transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"><LogOut size={18} aria-hidden="true" />Sair da conta</button>
            </div>
        </div>
    );

    return <MobileHeaderActionContext.Provider value={mobileHeaderActionTarget}><div data-testid="authenticated-layout" className="flex h-screen min-h-0 min-w-0 overflow-hidden bg-app-background [height:100dvh]">
        <aside className="hidden h-full w-64 shrink-0 lg:block">{sidebar}</aside>
        {open && <button type="button" aria-label="Fechar menu de navegação" data-testid="mobile-navigation-overlay" className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}
        <aside ref={mobileSidebarRef} id="navegacao-mobile" aria-label="Menu de navegação" aria-hidden={!open} inert={!open} className={`fixed inset-y-0 left-0 z-50 w-[min(18rem,90vw)] transform pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] transition-transform duration-200 lg:hidden ${open ? 'translate-x-0' : '-translate-x-full'}`} style={!open ? { visibility: 'hidden' } : undefined}>{sidebar}</aside>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div data-testid="authenticated-topbar" className="flex shrink-0 min-w-0 items-center border-b bg-white px-3 py-2 lg:hidden">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <button ref={menuButtonRef} type="button" aria-label="Abrir menu de navegação" aria-expanded={open} aria-controls="navegacao-mobile" onClick={() => setOpen(true)} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg p-2 text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"><Menu aria-hidden="true" size={24} /></button>
                    {activeTitle && <h1 title={`${activeTitle.icon} ${activeTitle.text}`.trim()} className="min-w-0 truncate text-lg font-bold text-gray-900 sm:hidden">{activeTitle.icon && <span aria-hidden="true">{activeTitle.icon} </span>}{activeTitle.text}</h1>}
                </div>
                {location.pathname === '/dashboard' && <div ref={setMobileHeaderActionTarget} data-testid="mobile-header-action" className="ml-auto shrink-0 sm:hidden" />}
            </div>
            <div className="min-h-0 min-w-0 flex-1 overflow-hidden"><Outlet /></div>
        </div>
    </div></MobileHeaderActionContext.Provider>;
}
