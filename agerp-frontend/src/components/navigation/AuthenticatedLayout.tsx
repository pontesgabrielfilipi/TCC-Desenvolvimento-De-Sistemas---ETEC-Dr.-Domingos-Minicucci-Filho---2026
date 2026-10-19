import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { navigationItems } from './navigationItems';
import { useAparenciaSistema } from '../../hooks/useAparenciaSistema';

export function AuthenticatedLayout() {
    const { user, logout } = useAuth();
    const { nomeEmpresa } = useAparenciaSistema();
    const [open, setOpen] = useState(false);
    useEffect(() => {
        if (!open) return;
        const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
        document.addEventListener('keydown', close);
        return () => document.removeEventListener('keydown', close);
    }, [open]);

    const sidebar = (
        <div className="flex h-full flex-col bg-slate-900 text-white">
            <div className="flex items-center justify-between border-b border-slate-800 p-6">
                <div className="min-w-0"><h1 className="brand break-words text-2xl font-bold tracking-tight" title={nomeEmpresa}>{nomeEmpresa}</h1><p className="mt-1 text-xs text-slate-400">Gestão Empresarial</p></div>
                <button type="button" onClick={() => setOpen(false)} aria-label="Fechar menu" className="rounded-lg p-2 hover:bg-slate-800 lg:hidden"><X aria-hidden="true" size={22} /></button>
            </div>
            <nav aria-label="Navegação principal" className="flex-1 space-y-1 overflow-y-auto p-4">
                {navigationItems.filter(item => !('profiles' in item) || !item.profiles || item.profiles.includes(user?.perfilNome ?? '')).map(item => {
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

    return <div className="flex h-screen min-w-0 overflow-hidden bg-slate-100">
        <aside className="hidden h-screen w-64 shrink-0 lg:block">{sidebar}</aside>
        {open && <button type="button" aria-label="Fechar menu de navegação" className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}
        <aside id="navegacao-mobile" aria-hidden={!open} className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 lg:hidden ${open ? 'translate-x-0' : '-translate-x-full'}`} style={!open ? { visibility: 'hidden' } : undefined}>{sidebar}</aside>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="border-b bg-white px-4 py-2 lg:hidden"><button type="button" aria-label="Abrir menu de navegação" aria-expanded={open} aria-controls="navegacao-mobile" onClick={() => setOpen(true)} className="rounded-lg p-2 text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"><Menu aria-hidden="true" size={24} /></button></div>
            <div className="min-h-0 min-w-0 flex-1 overflow-hidden"><Outlet /></div>
        </div>
    </div>;
}
