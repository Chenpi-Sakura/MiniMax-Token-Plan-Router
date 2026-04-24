import { useState, useEffect } from 'react';
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

    useEffect(() => {
        loadStats();
    }, [period]);

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

    const chartData = {
        labels: (statsData.dailyStats || []).map(d => d.date).reverse(),
        datasets: [
            {
                label: t('dashboard.totalRequests'),
                data: (statsData.dailyStats || []).map(d => d.requests).reverse(),
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                borderColor: 'rgb(59, 130, 246)',
                borderWidth: 1
            },
            {
                label: t('dashboard.success'),
                data: (statsData.dailyStats || []).map(d => d.successful).reverse(),
                backgroundColor: 'rgba(34, 197, 94, 0.5)',
                borderColor: 'rgb(34, 197, 94)',
                borderWidth: 1
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: { position: 'top' }
        },
        scales: {
            y: { beginAtZero: true }
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
                <div className="h-64">
                    <Bar data={chartData} options={chartOptions} />
                </div>
            </div>

            {statsData.topUsers && statsData.topUsers.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold mb-4">{t('dashboard.topUsers')}</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-2">{t('dashboard.username')}</th>
                                    <th className="text-right py-2">{t('dashboard.requests')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {statsData.topUsers.map((user, idx) => (
                                    <tr key={idx} className="border-b last:border-0">
                                        <td className="py-2">{user.username}</td>
                                        <td className="py-2 text-right">{user.requests.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Dashboard;