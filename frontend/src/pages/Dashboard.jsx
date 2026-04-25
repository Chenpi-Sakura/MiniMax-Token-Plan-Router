import { useState, useEffect, useRef } from 'react';
import { stats } from '../api';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import { Activity, Users, Key, AlertCircle } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function Dashboard() {
    const [statsData, setStatsData] = useState(null);
    const [period, setPeriod] = useState('7d');
    const [loading, setLoading] = useState(true);
    const { t } = useI18n();
    const chartContainerRef = useRef(null);
    const [chartHeight, setChartHeight] = useState(320);

    useEffect(() => {
        loadStats();
    }, [period]);

    useEffect(() => {
        const observer = new ResizeObserver(() => {
            if (chartContainerRef.current) {
                const h = chartContainerRef.current.clientHeight;
                if (h > 0) setChartHeight(h);
            }
        });
        if (chartContainerRef.current) {
            observer.observe(chartContainerRef.current);
        }
        return () => observer.disconnect();
    }, []);

    const loadStats = async () => {
        setLoading(true);
        try {
            const { data } = await stats.get(period);
            setStatsData(data);
        } catch (error) {
            console.error('Failed to load stats:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading || !statsData) {
        return <div className="text-gray-500">{t('app.loading')}</div>;
    }

    const isHourly = period === '24h';
    const rawSlots = statsData.dailyStats || [];

    const fillZeroSlots = () => {
        const now = new Date();
        const slots = [];

        if (isHourly) {
            for (let i = 23; i >= 0; i--) {
                const d = new Date(now.getTime() - i * 3600000);
                const slotKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`;
                const found = rawSlots.find(s => s.slot === slotKey);
                slots.push(found || { slot: slotKey, requests: 0, successful: 0, users: [] });
            }
        } else {
            const days = period === '7d' ? 7 : 30;
            for (let i = days - 1; i >= 0; i--) {
                const d = new Date(now.getTime() - i * 86400000);
                const slotKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                const found = rawSlots.find(s => s.slot === slotKey);
                slots.push(found || { slot: slotKey, requests: 0, successful: 0, users: [] });
            }
        }
        return slots;
    };

    const filledSlots = fillZeroSlots();

    const formatLabel = (slot) => {
        if (isHourly) {
            const [date, hour] = slot.split(' ');
            const [year, month, day] = date.split('-');
            return `${month}-${day} ${hour}`;
        }
        const [year, month, day] = slot.split('-');
        return `${month}-${day}`;
    };

    const labels = filledSlots.map(s => formatLabel(s.slot));

    const chartData = {
        labels,
        datasets: [
            {
                label: t('dashboard.success'),
                data: filledSlots.map(s => s.successful),
                backgroundColor: 'rgba(34, 197, 94, 0.7)',
                borderColor: 'rgb(34, 197, 94)',
                borderWidth: 1
            },
            {
                label: t('dashboard.failedRequests'),
                data: filledSlots.map(s => s.requests - s.successful),
                backgroundColor: 'rgba(239, 68, 68, 0.7)',
                borderColor: 'rgb(239, 68, 68)',
                borderWidth: 1
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false
        },
        plugins: {
            legend: { position: 'top' },
            tooltip: {
                callbacks: {
                    afterBody: (tooltipItems) => {
                        const idx = tooltipItems[0].dataIndex;
                        const slot = filledSlots[idx];
                        const total = slot.requests;
                        const success = slot.successful;
                        const failed = total - success;
                        const lines = [
                            `${t('dashboard.totalRequests')}: ${total}`,
                            `${t('dashboard.success')}: ${success}`,
                            `${t('dashboard.failedRequests')}: ${failed}`,
                            ''
                        ];
                        if (!slot.users || slot.users.length === 0) {
                            lines.push(t('dashboard.noUsersInSlot'));
                        } else {
                            lines.push(`${t('dashboard.users')}:`);
                            const maxShow = 8;
                            const shown = slot.users.slice(0, maxShow);
                            shown.forEach(u => {
                                lines.push(`  ${u.username}: ${u.requests}`);
                            });
                            if (slot.users.length > maxShow) {
                                lines.push(`  ... ${t('dashboard.andMoreUsers').replace('{n}', slot.users.length - maxShow)}`);
                            }
                        }
                        return lines;
                    }
                }
            }
        },
        scales: {
            y: { beginAtZero: true, stacked: true },
            x: { stacked: true }
        }
    };

    const topUsersData = {
        labels: (statsData.topUsers || []).map(u => u.username),
        datasets: [{
            label: t('dashboard.requests'),
            data: (statsData.topUsers || []).map(u => u.requests),
            backgroundColor: 'rgba(59, 130, 246, 0.6)',
            borderColor: 'rgb(59, 130, 246)',
            borderWidth: 1
        }]
    };

    const topUsersOptions = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
            legend: { display: false }
        },
        scales: {
            x: { beginAtZero: true }
        }
    };

    const statCards = [
        {
            label: t('dashboard.totalRequests'),
            value: statsData.total_requests || 0,
            icon: Activity,
            color: 'blue'
        },
        {
            label: t('dashboard.activeUsers'),
            value: statsData.total_users || 0,
            icon: Users,
            color: 'green'
        },
        {
            label: t('dashboard.activeKeys'),
            value: statsData.active_keys || 0,
            icon: Key,
            color: 'purple'
        },
        {
            label: t('dashboard.failedRequests'),
            value: statsData.failed_requests || 0,
            icon: AlertCircle,
            color: 'red'
        }
    ];

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">{t('dashboard.title')}</h1>
                <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                    <option value="24h">{t('dashboard.last24h')}</option>
                    <option value="7d">{t('dashboard.last7d')}</option>
                    <option value="30d">{t('dashboard.last30d')}</option>
                </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {statCards.map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-white rounded-lg shadow p-4">
                        <div className="flex items-center">
                            <div className={`p-2 rounded-full bg-${color}-100 text-${color}-600`}>
                                <Icon className="w-5 h-5" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm text-gray-500">{label}</p>
                                <p className="text-xl font-semibold">{value.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">{t('dashboard.requestTrend')}</h2>
                <div ref={chartContainerRef} style={{ height: chartHeight, position: 'relative' }}>
                    <Bar data={chartData} options={chartOptions} />
                </div>
            </div>

            {statsData.topUsers && statsData.topUsers.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold mb-4">{t('dashboard.topUsers')}</h2>
                    <div style={{ height: Math.max(200, statsData.topUsers.length * 40), position: 'relative' }}>
                        <Bar data={topUsersData} options={topUsersOptions} />
                    </div>
                </div>
            )}
        </div>
    );
}

export default Dashboard;