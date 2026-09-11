'use client';

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { UserRole, Specialization, User } from '../types/task';
import { Users, Plus, Shield, Edit2, Trash2, CheckSquare, Square } from 'lucide-react';

const ALL_SPECIALIZATIONS: Specialization[] = ['BA', 'Design', 'FE', 'BE', 'QA'];

export const UserManagementView: React.FC = () => {
  const { users, addUser, updateUser, deleteUser, currentUser } = useApp();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [account, setAccount] = useState('');
  const [role, setRole] = useState<UserRole>('Member');
  const [selectedSpecs, setSelectedSpecs] = useState<Specialization[]>(['BA']);

  const handleOpenAdd = () => {
    setEditingUserId(null);
    setName('');
    setAccount('');
    setRole('Member');
    setSelectedSpecs(['BA']);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUserId(user.id);
    setName(user.name);
    setAccount(user.account);
    setRole(user.role);
    setSelectedSpecs(user.specializations || ['BA']);
    setIsFormOpen(true);
  };

  const toggleSpec = (spec: Specialization) => {
    if (selectedSpecs.includes(spec)) {
      if (selectedSpecs.length === 1) return;
      setSelectedSpecs(selectedSpecs.filter((s) => s !== spec));
    } else {
      setSelectedSpecs([...selectedSpecs, spec]);
    }
  };

  const handleSubmitUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !account.trim()) return;

    if (editingUserId) {
      updateUser(editingUserId, {
        name,
        account: account.trim(),
        role,
        specializations: selectedSpecs,
      });
    } else {
      addUser({
        name,
        account: account.trim(),
        role,
        specializations: selectedSpecs,
      });
    }

    setIsFormOpen(false);
  };

  const handleDelete = (user: User) => {
    if (
      confirm(
        `Bạn có chắc chắn muốn xóa thành viên ${user.name} (${user.account})?\n\nTất cả task của thành viên này sẽ chuyển thành Task Trống (Chưa phân công) để Leader giao cho người khác và vẫn giữ nguyên % đã hoàn thành.`
      )
    ) {
      deleteUser(user.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 text-purple-500" />
              Quản Lý Thành Viên, Đa Chuyên Môn & Phân Quyền
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-300">
              Admin Only
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Admin tạo/sửa/xóa thành viên, gán role (Leader / Member) và chọn kiêm nhiệm nhiều chuyên môn.
          </p>
        </div>

        {currentUser?.role === 'Admin' && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-purple-600/20 transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            Tạo Tài Khoản Mới
          </button>
        )}
      </div>

      {/* Add / Edit User Form */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmitUser}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4"
        >
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-500" />
            {editingUserId ? 'Chỉnh Sửa Tài Khoản & Đa Chuyên Môn' : 'Tạo Tài Khoản & Phân Quyền Mới'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Tên Hiển Thị (Full Name):
              </label>
              <input
                type="text"
                placeholder="VD: Nguyễn Văn A"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Tên Account (Mã định danh):
              </label>
              <input
                type="text"
                placeholder="VD: AnNV, HuyPQ..."
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Cấp Phân Quyền (Role):
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-purple-400"
              >
                <option value="Member">Member (Thành viên báo cáo)</option>
                <option value="Leader">Leader (Break task & Phân công)</option>
                <option value="Admin">Admin (Quản trị hệ thống)</option>
              </select>
            </div>

            {/* MULTI-SPECIALIZATION CHECKBOXES */}
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Vị Trí Chuyên Môn Kiêm Nhiệm (Chọn một hoặc nhiều):
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                {ALL_SPECIALIZATIONS.map((spec) => {
                  const isChecked = selectedSpecs.includes(spec);
                  return (
                    <button
                      key={spec}
                      type="button"
                      onClick={() => toggleSpec(spec)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition flex items-center gap-1.5 ${
                        isChecked
                          ? 'bg-purple-100 text-purple-700 border-purple-400 shadow-sm'
                          : 'bg-slate-50 text-slate-500 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-3.5 h-3.5 text-purple-600" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      {spec}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 bg-slate-100 text-slate-600 text-xs rounded-xl hover:bg-slate-200 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-purple-600 text-white text-xs font-semibold rounded-xl hover:bg-purple-500 shadow-md shadow-purple-600/20 transition"
            >
              {editingUserId ? 'Lưu Thay Đổi' : 'Tạo Account'}
            </button>
          </div>
        </form>
      )}

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-800">
            Danh Sách Thành Viên ({users.length} tài khoản)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-4">Account</th>
                <th className="py-3 px-4">Tên Hiển Thị</th>
                <th className="py-3 px-3">Các Chuyên Môn Kiêm Nhiệm</th>
                <th className="py-3 px-3 text-center">Phân Quyền (Role)</th>
                <th className="py-3 px-4 text-right">Thao Tác Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-4 font-mono font-bold text-indigo-600">
                    {u.account}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-700">{u.name}</td>
                  <td className="py-3 px-3">
                    <div className="flex flex-wrap gap-1">
                      {(u.specializations || ['BA']).map((s) => (
                        <span
                          key={s}
                          className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-semibold text-[10px]"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold border ${
                        u.role === 'Admin'
                          ? 'bg-purple-100 text-purple-700 border-purple-300'
                          : u.role === 'Leader'
                          ? 'bg-amber-100 text-amber-700 border-amber-300'
                          : 'bg-blue-100 text-blue-700 border-blue-300'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {currentUser?.role === 'Admin' && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="p-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 rounded-lg transition"
                          title="Sửa chuyên môn & role"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-500 rounded-lg transition"
                          title="Xóa tài khoản thành viên (chuyển task về trống)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
