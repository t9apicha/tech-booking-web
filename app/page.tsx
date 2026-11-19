'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db, saveSession, UserRole } from '@/lib/supabase';
import { Wrench, User, ShieldCheck, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Province {
  ProvinceID: string;
  ProvinceName: string;
}

interface ServiceCategory {
  CategoryID: string;
  MainCategory: string;
  CategoryName: string;
  CategoryPrice: number;
}

export default function AuthPage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>('customer');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const [provinces, setProvinces] = useState<Province[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);

  // Login states
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Register states
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regProvince, setRegProvince] = useState('');
  const [regMainCategory, setRegMainCategory] = useState('');
  const [regCategory, setRegCategory] = useState('');
  const [regAddress, setRegAddress] = useState('');

  useEffect(() => {
    async function fetchMasterData() {
      const { data: provData } = await db.from('Provinces').select('*');
      if (provData) setProvinces(provData);

      const { data: catData } = await db.from('ServiceCategories').select('*');
      if (catData) setCategories(catData as ServiceCategory[]);
    }
    fetchMasterData();
  }, []);

  // ดึงรายชื่อหมวดช่างหลักแบบไม่ซ้ำ (ช่างแอร์, ช่างประปา, ช่างไฟฟ้า)
  const mainCategories = Array.from(
    new Set(categories.map((c) => c.MainCategory).filter(Boolean))
  );

  // กรองบริการย่อยตามหมวดช่างหลักที่เลือก
  const subCategories = categories.filter((c) => c.MainCategory === regMainCategory);

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    setAlert(null);
    if (newRole === 'admin' && mode === 'register') {
      setMode('login');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAlert(null);

    try {
      if (role === 'customer') {
        const { data, error } = await db
          .from('Customers')
          .select('*')
          .eq('CustomerEmail', identifier.trim())
          .eq('CustomerPassword', password)
          .single();

        if (error || !data) throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        saveSession('customer', data);
        router.push('/customer');
      } else if (role === 'technician') {
        const { data, error } = await db
          .from('Technicians')
          .select('*')
          .eq('TechnicianEmail', identifier.trim())
          .eq('TechnicianPassword', password)
          .single();

        if (error || !data) throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        if (!data.approved) {
          throw new Error('บัญชีช่างของคุณอยู่ระหว่างรอแอดมินตรวจสอบและอนุมัติ');
        }
        saveSession('technician', data);
        router.push('/technician');
      } else if (role === 'admin') {
        const { data, error } = await db
          .from('Admins')
          .select('*')
          .eq('AdminName', identifier.trim())
          .eq('AdminPassword', password)
          .single();

        if (error || !data) throw new Error('ชื่อผู้ใช้งานหรือรหัสผ่านแอดมินไม่ถูกต้อง');
        saveSession('admin', data);
        router.push('/admin');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
      setAlert({ type: 'error', text: message });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAlert(null);

    const randomCode = Math.floor(1000 + Math.random() * 9000);

    try {
      if (role === 'customer') {
        const { error } = await db.from('Customers').insert([
          {
            CustomerID: `CUS${randomCode}`,
            CustomerName: regName.trim(),
            CustomerEmail: regEmail.trim(),
            CustomerPassword: regPassword,
            CustomerPhone: regPhone.trim(),
            ProvinceID: regProvince,
          },
        ]);
        if (error) throw new Error(error.message);

        setAlert({ type: 'success', text: 'สมัครสมาชิกลูกค้าสำเร็จ! กรุณาเข้าสู่ระบบ' });
        setMode('login');
      } else if (role === 'technician') {
        const { error } = await db.from('Technicians').insert([
          {
            TechnicianID: `TEC${randomCode}`,
            TechnicianName: regName.trim(),
            TechnicianEmail: regEmail.trim(),
            TechnicianPassword: regPassword,
            TechnicianPhone: regPhone.trim(),
            ProvinceID: regProvince,
            CategoryID: regCategory,
            Address: regAddress.trim(),
            approved: false,
          },
        ]);
        if (error) throw new Error(error.message);

        setAlert({
          type: 'success',
          text: 'ลงทะเบียนช่างสำเร็จ! กรุณารอแอดมินกดอนุมัติก่อนเข้าใช้งาน',
        });
        setMode('login');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'สมัครสมาชิกไม่สำเร็จ';
      setAlert({ type: 'error', text: `สมัครไม่สำเร็จ: ${message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-lg p-8 border border-slate-200">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white mb-3">
            <Wrench className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">
            {mode === 'login' ? 'เข้าสู่ระบบบริการช่าง' : 'สมัครสมาชิกใหม่'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">เลือกประเภทผู้ใช้งานของคุณด้านล่าง</p>
        </div>

        {alert && (
          <div
            className={`flex items-center gap-2 p-3.5 rounded-xl text-sm mb-5 ${
              alert.type === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
          >
            {alert.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{alert.text}</span>
          </div>
        )}

        {/* แถบเลือกบทบาท */}
        <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1.5 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => handleRoleChange('customer')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition ${
              role === 'customer'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-4 h-4" /> ลูกค้า
          </button>
          <button
            type="button"
            onClick={() => handleRoleChange('technician')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition ${
              role === 'technician'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wrench className="w-4 h-4" /> ช่างซ่อม
          </button>
          {mode === 'login' && (
            <button
              type="button"
              onClick={() => handleRoleChange('admin')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition ${
                role === 'admin'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4" /> แอดมิน
            </button>
          )}
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {role === 'admin' ? 'ชื่อผู้ใช้งานแอดมิน (AdminName)' : 'อีเมล'}
              </label>
              <input
                type={role === 'admin' ? 'text' : 'email'}
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={role === 'admin' ? 'เช่น Super Admin' : 'example@email.com'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">รหัสผ่าน</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              เข้าสู่ระบบ
            </button>

            {role !== 'admin' && (
              <p className="text-center text-sm text-slate-600 pt-2">
                ยังไม่มีบัญชีใช่ไหม?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setAlert(null);
                  }}
                  className="text-blue-600 font-semibold hover:underline"
                >
                  สมัครสมาชิกที่นี่
                </button>
              </p>
            )}
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อ - นามสกุล</label>
              <input
                type="text"
                maxLength={30}
                required
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="เช่น สมชาย ใจดี"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">อีเมล</label>
              <input
                type="email"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">รหัสผ่าน</label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">เบอร์โทร (10 หลัก)</label>
                <input
                  type="text"
                  maxLength={10}
                  required
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="0812345678"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">จังหวัด</label>
              <select
                required
                value={regProvince}
                onChange={(e) => setRegProvince(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- เลือกจังหวัด --</option>
                {provinces.map((p) => (
                  <option key={p.ProvinceID} value={p.ProvinceID}>
                    {p.ProvinceName}
                  </option>
                ))}
              </select>
            </div>

            {role === 'technician' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      1. ประเภทช่างหลัก
                    </label>
                    <select
                      required
                      value={regMainCategory}
                      onChange={(e) => {
                        setRegMainCategory(e.target.value);
                        setRegCategory('');
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="">-- เลือกประเภทช่าง --</option>
                      {mainCategories.map((mc) => (
                        <option key={mc} value={mc}>
                          {mc}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      2. บริการที่รับทำ
                    </label>
                    <select
                      required
                      disabled={!regMainCategory}
                      value={regCategory}
                      onChange={(e) => setRegCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 bg-white disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="">-- เลือกบริการ --</option>
                      {subCategories.map((c) => (
                        <option key={c.CategoryID} value={c.CategoryID}>
                          {c.CategoryName} ({c.CategoryPrice} ฿)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ที่อยู่ปัจจุบัน</label>
                  <textarea
                    rows={2}
                    required
                    value={regAddress}
                    onChange={(e) => setRegAddress(e.target.value)}
                    placeholder="บ้านเลขที่, ซอย, ถนน..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              ยืนยันการสมัครสมาชิก
            </button>

            <p className="text-center text-sm text-slate-600 pt-1">
              มีบัญชีอยู่แล้ว?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setAlert(null);
                }}
                className="text-blue-600 font-semibold hover:underline"
              >
                กลับไปหน้าเข้าสู่ระบบ
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}