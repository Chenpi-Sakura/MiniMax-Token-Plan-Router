import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { auth } from '../api';
import { LayoutDashboard, Users, Key, FileText, LogOut, Globe } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

function Layout() {
    const navigate = useNavigate();
    const { locale, changeLocale, t } = useI18n();

    const handleLogout = async () => {
        try {
            await auth.logout();
        } catch (error) {
            console.error('Logout error:', error);
        }
        navigate('/login');
    };

    const navItems = [
        { to: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
        { to: '/users', icon: Users, label: t('nav.users') },
        { to: '/keys', icon: Key, label: t('nav.keys') },
        { to: '/logs', icon: FileText, label: t('nav.logs') }
    ];

    return (
        <div className="min-h-screen bg-gray-100">
            <nav className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex">
                            <div className="flex-shrink-0 flex items-center">
                                <h1 className="text-xl font-bold text-gray-800">MiniMax Proxy</h1>
                            </div>
                            <div className="hidden sm:ml-6 sm:flex sm:space-x-4">
                                {navItems.map(({ to, icon: Icon, label }) => (
                                    <NavLink
                                        key={to}
                                        to={to}
                                        className={({ isActive }) =>
                                            `inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                                                isActive
                                                    ? 'border-blue-500 text-gray-900'
                                                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                            }`
                                        }
                                    >
                                        <Icon className="w-4 h-4 mr-1" />
                                        {label}
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="relative">
                                <select
                                    value={locale}
                                    onChange={(e) => changeLocale(e.target.value)}
                                    className="appearance-none bg-gray-50 border border-gray-300 rounded-md pl-3 pr-8 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="zh">中文</option>
                                    <option value="en">English</option>
                                </select>
                                <Globe className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                            <button
                                onClick={handleLogout}
                                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-gray-500 hover:text-gray-700"
                            >
                                <LogOut className="w-4 h-4 mr-1" />
                                {t('nav.logout')}
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Outlet />
            </main>
        </div>
    );
}

export default Layout;