import { useState, useEffect } from 'react';
import { keys, users as usersApi, auth } from '../api';
import { Plus, Trash2, Copy, ToggleLeft, ToggleRight, AlertCircle } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

function formatDate(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}/${m}/${day}`;
}

function Keys() {
    const [keyList, setKeyList] = useState([]);
    const [userList, setUserList] = useState([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showCreatedModal, setShowCreatedModal] = useState(false);
    const [createdKey, setCreatedKey] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        userId: '',
        quotaLimit: '',
        expiresAt: ''
    });
    const { t } = useI18n();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const meRes = await auth.me();
            setIsAdmin(meRes.data.isAdmin);
            const [keysRes] = await Promise.all([
                keys.list()
            ]);
            setKeyList(keysRes.data);
            if (meRes.data.isAdmin) {
                try {
                    const usersRes = await usersApi.list();
                    setUserList(usersRes.data);
                } catch (e) {
                    console.error('Failed to load users:', e);
                }
            }
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                name: formData.name || null,
                expiresAt: formData.expiresAt || null,
                quotaLimit: formData.quotaLimit ? parseInt(formData.quotaLimit) : null
            };
            if (isAdmin && formData.userId) {
                payload.userId = parseInt(formData.userId);
            }
            const { data } = await keys.create(payload);
            setCreatedKey(data);
            setShowModal(false);
            setShowCreatedModal(true);
            setFormData({ name: '', userId: '', quotaLimit: '', expiresAt: '' });
            loadData();
        } catch (error) {
            alert(error.response?.data?.error || 'Create failed');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm(t('keys.confirmDelete'))) return;
        try {
            await keys.delete(id);
            loadData();
        } catch (error) {
            alert(error.response?.data?.error || 'Delete failed');
        }
    };

    const handleToggle = async (id) => {
        try {
            await keys.toggle(id);
            loadData();
        } catch (error) {
            alert(error.response?.data?.error || 'Toggle failed');
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert(t('keys.keyCopied'));
    };

    if (loading) {
        return <div className="text-gray-500">{t('app.loading')}</div>;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">{t('keys.title')}</h1>
                <button
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                    <Plus className="w-4 h-4 mr-1" />
                    {t('keys.createKey')}
                </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('keys.keyPrefix')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('keys.userId')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('keys.quotaUsed')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('keys.limit')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('keys.expiresAt')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('keys.status')}</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('keys.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {keyList.map((key) => (
                            <tr key={key.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{key.name || '-'}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-mono text-gray-500">{key.maskedKey}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-500">{key.username || '-'}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-500">{key.quotaUsed.toLocaleString()}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-500">
                                        {key.quotaLimit ? key.quotaLimit.toLocaleString() : t('keys.unlimited')}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-500">
                                        {formatDate(key.expiresAt) || t('keys.neverExpires')}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <button
                                        onClick={() => handleToggle(key.id)}
                                        className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${
                                            key.isActive
                                                ? 'text-green-700 bg-green-100'
                                                : 'text-red-700 bg-red-100'
                                        }`}
                                    >
                                        {key.isActive ? (
                                            <ToggleRight className="w-4 h-4 mr-1" />
                                        ) : (
                                            <ToggleLeft className="w-4 h-4 mr-1" />
                                        )}
                                        {key.isActive ? t('users.active') : t('users.inactive')}
                                    </button>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => handleDelete(key.id)}
                                        className="text-red-600 hover:text-red-900"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {keyList.length === 0 && (
                            <tr>
                                <td colSpan="8" className="px-6 py-4 text-center text-gray-500">
                                    {t('common.noData')}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">{t('keys.createKey')}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Key Name</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Optional label"
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                                    />
                                </div>
                                {isAdmin && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">{t('keys.userId')}</label>
                                        <select
                                            value={formData.userId}
                                            onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                                        >
                                            <option value="">{t('keys.selectUser')}</option>
                                            {userList.length === 0 ? (
                                                <option disabled value="">{t('keys.noUsers')}</option>
                                            ) : (
                                                userList.map((user) => (
                                                    <option key={user.id} value={String(user.id)}>{user.username}</option>
                                                ))
                                            )}
                                        </select>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{t('keys.quotaLimit')} ({t('keys.unlimited')})</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.quotaLimit}
                                        onChange={(e) => setFormData({ ...formData, quotaLimit: e.target.value })}
                                        placeholder={t('keys.noLimit')}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{t('keys.expiresAt')}</label>
                                    <input
                                        type="date"
                                        value={formData.expiresAt}
                                        onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                                    />
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    {t('common.create')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showCreatedModal && createdKey && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <div className="flex items-center text-yellow-500 mb-4">
                            <AlertCircle className="w-6 h-6 mr-2" />
                            <h2 className="text-xl font-bold">{t('keys.createKey')}</h2>
                        </div>
                        <p className="text-gray-600 mb-4">
                            {t('keys.createSuccess')}
                        </p>
                        <div className="bg-gray-100 p-3 rounded-md font-mono text-sm break-all mb-4">
                            {createdKey.apiKey}
                        </div>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => copyToClipboard(createdKey.apiKey)}
                                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                                <Copy className="w-4 h-4 mr-1" />
                                {t('keys.copyKey')}
                            </button>
                            <button
                                onClick={() => {
                                    setShowCreatedModal(false);
                                    setCreatedKey(null);
                                }}
                                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                            >
                                {t('common.close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Keys;