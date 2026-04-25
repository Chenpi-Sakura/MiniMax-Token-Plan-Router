import { useState, useEffect } from 'react';
import { users } from '../api';
import { Plus, Edit, Trash2, Shield } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

function Users() {
    const [userList, setUserList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        isAdmin: false
    });
    const { t } = useI18n();

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const { data } = await users.list();
            setUserList(data);
        } catch (error) {
            console.error('Failed to load users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                username: formData.username,
                password: formData.password,
                isAdmin: formData.isAdmin
            };
            if (!payload.password && editingUser) {
                delete payload.password;
            }
            if (editingUser) {
                await users.update(editingUser.id, payload);
            } else {
                await users.create(payload);
            }
            setShowModal(false);
            setEditingUser(null);
            setFormData({ username: '', password: '', isAdmin: false });
            loadUsers();
        } catch (error) {
            alert(error.response?.data?.error || 'Operation failed');
        }
    };

    const handleEdit = (user) => {
        setEditingUser(user);
        setFormData({
            username: user.username,
            password: '',
            isAdmin: user.isAdmin
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!confirm(t('users.confirmDelete'))) return;
        try {
            await users.delete(id);
            loadUsers();
        } catch (error) {
            alert(error.response?.data?.error || 'Delete failed');
        }
    };

    const openCreateModal = () => {
        setEditingUser(null);
        setFormData({ username: '', password: '', isAdmin: false });
        setShowModal(true);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">{t('users.title')}</h1>
                <button
                    onClick={openCreateModal}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                    <Plus className="w-4 h-4 mr-1" />
                    {t('users.addUser')}
                </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('users.username')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('users.isAdmin')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">API Keys</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Usage</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('users.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {userList.map((user) => (
                            <tr key={user.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{user.username}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {user.isAdmin ? (
                                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-purple-700 bg-purple-100 rounded">
                                            <Shield className="w-3 h-3 mr-1" />
                                            Admin
                                        </span>
                                    ) : (
                                        <span className="text-sm text-gray-500">User</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {user.keyCount}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {user.totalUsage.toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => handleEdit(user)}
                                        className="text-blue-600 hover:text-blue-900 mr-3"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(user.id)}
                                        className="text-red-600 hover:text-red-900"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">
                            {editingUser ? t('users.editUser') : t('users.addUser')}
                        </h2>
                        <form onSubmit={handleSubmit}>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{t('users.username')}</label>
                                    <input
                                        type="text"
                                        required
                                        disabled={editingUser}
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 disabled:bg-gray-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        {t('users.password')} {editingUser && '(leave blank to keep)'}
                                    </label>
                                    <input
                                        type="password"
                                        required={!editingUser}
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                                    />
                                </div>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="isAdmin"
                                        checked={formData.isAdmin}
                                        onChange={(e) => setFormData({ ...formData, isAdmin: e.target.checked })}
                                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                                    />
                                    <label htmlFor="isAdmin" className="ml-2 text-sm text-gray-700">
                                        {t('users.isAdmin')}
                                    </label>
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
                                    {editingUser ? t('common.save') : t('common.create')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Users;