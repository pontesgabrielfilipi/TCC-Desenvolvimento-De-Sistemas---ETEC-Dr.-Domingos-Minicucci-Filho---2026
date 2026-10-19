import { LayoutDashboard, Users, Package, ClipboardList, Shield } from 'lucide-react';

export const navigationItems = [
    { label: 'Administração', path: '/admin', icon: Shield, profiles: ['ADMIN'] },
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Clientes', path: '/clientes', icon: Users },
    { label: 'Produtos', path: '/produtos', icon: Package },
    { label: 'Pedidos', path: '/pedidos', icon: ClipboardList },
];
