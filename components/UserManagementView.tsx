import React, { useState, useEffect } from 'react';
import { User } from '../types'; // AppUser is aliased as User here
import { PencilSquareIcon, TrashIcon, UserPlusIcon, XMarkIcon } from './Icons';
import { BRAND_BLUE, ADMIN_EMAIL } from '../constants';

interface UserManagementViewProps {
  users: User[]; // Full list of users from Firestore
  currentUser: User; // Current logged-in admin user
  onAddUser: (userData: Omit<User, 'uid' | 'role'> & { email: string, password?: string, role: 'admin' | 'user' }) => Promise<void>;
  onEditUser: (uid: string, userData: Partial<Omit<User, 'uid' | 'email'>>) => Promise<void>;
  onDeleteUser: (uid: string) => Promise<void>;
  onClose: () => void;
}

const UserManagementView: React.FC<UserManagementViewProps> = ({
  users,
  currentUser,
  onAddUser,
  onEditUser,
  onDeleteUser,
  onClose
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'user' as 'user' | 'admin' });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openModalForAdd = () => {
    setEditingUser(null);
    setFormData({ name: '', email: '', password: '', role: 'user' });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openModalForEdit = (user: User) => {
    setEditingUser(user);
    setFormData({ name: user.name, email: user.email, password: '', role: user.role });
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setFormError(null);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    if (!formData.name.trim()) {
      setFormError("El nombre es obligatorio.");
      setIsSubmitting(false);
      return;
    }
    if (!editingUser && !formData.email.trim().endsWith('@kanguro.com')) {
      setFormError("El email debe ser de dominio @kanguro.com.");
      setIsSubmitting(false);
      return;
    }
    if (!editingUser && users.find(u => u.email.toLowerCase() === formData.email.toLowerCase().trim())) {
      setFormError("Este email ya está registrado.");
      setIsSubmitting(false);
      return;
    }
    if (!editingUser && !formData.password) {
      setFormError("La contraseña es obligatoria para nuevos usuarios.");
      setIsSubmitting(false);
      return;
    }
     if (formData.password && formData.password.length < 6) {
      setFormError("La contraseña debe tener al menos 6 caracteres.");
      setIsSubmitting(false);
      return;
    }

    try {
      if (editingUser) {
        const updateData: Partial<Omit<User, 'uid' | 'email'>> = {
          name: formData.name,
          role: formData.role as 'user' | 'admin',
        };
        // Note: Password changes for other users are complex and typically require Admin SDK or re-auth.
        // This form doesn't implement direct password change for existing users via admin panel for simplicity.
        // If password field is filled for an existing user, it's currently ignored by onEditUser's signature.
        
        if (editingUser.email === ADMIN_EMAIL && formData.role === 'user') {
            const adminCount = users.filter(u => u.role === 'admin').length;
            if (adminCount === 1) {
                setFormError("No puedes cambiar el rol del administrador principal si es el único.");
                setIsSubmitting(false);
                return;
            }
        }
        await onEditUser(editingUser.uid, updateData);
      } else {
        await onAddUser({
          email: formData.email.toLowerCase().trim(),
          name: formData.name.trim(),
          password: formData.password, // Password sent for Firebase Auth creation
          role: formData.role as 'user' | 'admin',
        });
      }
      closeModal();
    } catch (error: any) {
      setFormError(error.message || "Error al guardar usuario.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (uid: string) => {
    const userToDelete = users.find(u => u.uid === uid);
    if (!userToDelete) return;

    if (uid === currentUser.uid) {
      alert("No puedes eliminarte a ti mismo.");
      return;
    }
     if (userToDelete.email === ADMIN_EMAIL && users.filter(u => u.role === 'admin').length <=1) {
        alert("No puedes eliminar al administrador principal si es el único.");
        return;
    }
    if (window.confirm(`¿Estás seguro de que quieres eliminar al usuario ${userToDelete.email}?\nEsto eliminará sus datos de la aplicación, pero la cuenta de autenticación de Firebase podría requerir limpieza manual si no se usa un backend con Admin SDK.`)) {
      setIsSubmitting(true);
      try {
        await onDeleteUser(uid);
      } catch (error: any) {
        alert(`Error al eliminar usuario: ${error.message}`);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="p-3 h-full flex flex-col bg-slate-50">
      <div className="mb-3 flex justify-between items-center">
        <h1 className="text-lg font-bold text-slate-800">Gestión de Usuarios</h1>
        <button
          onClick={openModalForAdd}
          disabled={isSubmitting}
          className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-blue-700 flex items-center shadow-sm disabled:opacity-50"
          style={{ backgroundColor: BRAND_BLUE }}
        >
          <UserPlusIcon className="w-4 h-4 mr-1.5" />
          Añadir Usuario
        </button>
      </div>

      <div className="flex-grow overflow-y-auto bg-white shadow-md rounded-lg">
        <table className="min-w-full divide-y divide-slate-200 text-xs">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">Email</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">Nombre</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">Rol</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {users.map((user) => (
              <tr key={user.uid} className="hover:bg-slate-50 transition-colors">
                <td className="px-3 py-2 whitespace-nowrap text-slate-700">{user.email}</td>
                <td className="px-3 py-2 whitespace-nowrap text-slate-700">{user.name}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={`px-2 py-0.5 inline-flex text-[10px] leading-4 font-semibold rounded-full ${
                    user.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <button
                    onClick={() => openModalForEdit(user)}
                    disabled={isSubmitting}
                    className="text-blue-600 hover:text-blue-800 mr-2 p-1 disabled:opacity-50"
                    aria-label={`Editar ${user.name}`}
                  >
                    <PencilSquareIcon className="w-4 h-4" />
                  </button>
                  {user.uid !== currentUser.uid && (
                    <button
                      onClick={() => handleDelete(user.uid)}
                      disabled={isSubmitting}
                      className="text-red-600 hover:text-red-800 p-1 disabled:opacity-50"
                      aria-label={`Eliminar ${user.name}`}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
       <button 
            onClick={onClose} 
            disabled={isSubmitting}
            className="mt-3 w-full px-3 py-2 text-xs font-medium text-white rounded-md shadow-sm disabled:opacity-50"
            style={{backgroundColor: BRAND_BLUE}}
        >
            Volver al Panel
        </button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-5 rounded-lg shadow-xl w-full max-w-md text-xs">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base font-semibold text-slate-800">
                {editingUser ? 'Editar Usuario' : 'Añadir Nuevo Usuario'}
              </h2>
              <button onClick={closeModal} disabled={isSubmitting} className="text-slate-400 hover:text-slate-600 p-1 disabled:opacity-50"><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              {formError && <p className="text-red-600 bg-red-50 p-2 rounded-md text-xs">{formError}</p>}
              <div>
                <label htmlFor="name" className="block text-[11px] font-medium text-slate-700 mb-0.5">Nombre Completo:</label>
                <input
                  type="text"
                  name="name"
                  id="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  className="w-full p-2 bg-white text-slate-800 border border-slate-300 rounded-md shadow-sm focus:ring-1 focus:border-transparent disabled:bg-slate-50"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-[11px] font-medium text-slate-700 mb-0.5">Email (@kanguro.com):</label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  value={formData.email}
                  onChange={handleFormChange}
                  readOnly={!!editingUser}
                  className={`w-full p-2 bg-white text-slate-800 border border-slate-300 rounded-md shadow-sm focus:ring-1 focus:border-transparent ${!!editingUser || isSubmitting ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                  required={!editingUser}
                  placeholder="usuario@kanguro.com"
                  disabled={!!editingUser || isSubmitting}
                />
              </div>
              {!editingUser && ( // Password only for new users
                <div>
                  <label htmlFor="password" className="block text-[11px] font-medium text-slate-700 mb-0.5">
                    Contraseña (mín. 6 caracteres):
                  </label>
                  <input
                    type="password"
                    name="password"
                    id="password"
                    value={formData.password}
                    onChange={handleFormChange}
                    className="w-full p-2 bg-white text-slate-800 border border-slate-300 rounded-md shadow-sm focus:ring-1 focus:border-transparent disabled:bg-slate-50"
                    required={!editingUser}
                    minLength={6}
                    disabled={isSubmitting}
                  />
                </div>
              )}
              <div>
                <label htmlFor="role" className="block text-[11px] font-medium text-slate-700 mb-0.5">Rol:</label>
                <select
                  name="role"
                  id="role"
                  value={formData.role}
                  onChange={handleFormChange}
                  className="w-full p-2 bg-white text-slate-800 border border-slate-300 rounded-md shadow-sm focus:ring-1 focus:border-transparent disabled:bg-slate-50"
                  disabled={isSubmitting || (editingUser?.email === ADMIN_EMAIL && users.filter(u=>u.role === 'admin').length <=1) }
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                 {(editingUser?.email === ADMIN_EMAIL && users.filter(u=>u.role === 'admin').length <=1) && 
                    <p className="text-red-500 text-[10px] mt-0.5">El rol del admin principal no puede cambiarse si es el único.</p>
                 }
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-md font-medium disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3 py-1.5 text-white rounded-md font-medium hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: BRAND_BLUE }}
                >
                  {isSubmitting ? 'Guardando...' : (editingUser ? 'Guardar Cambios' : 'Crear Usuario')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementView;
