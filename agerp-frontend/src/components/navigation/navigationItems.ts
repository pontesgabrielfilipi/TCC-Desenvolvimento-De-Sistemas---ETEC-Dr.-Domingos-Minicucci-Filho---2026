import { LayoutDashboard, Users, Package, ClipboardList, Shield } from 'lucide-react';

export const navigationItems = [
    { label: 'Administração', path: '/admin', icon: Shield, profiles: ['ADMIN'], page: 'ADMIN' },
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, page: 'DASHBOARD' },
    { label: 'Clientes', path: '/clientes', icon: Users, page: 'CLIENTES' },
    { label: 'Produtos', path: '/produtos', icon: Package, page: 'PRODUTOS' },
    { label: 'Pedidos', path: '/pedidos', icon: ClipboardList, page: 'PEDIDOS' },
];
