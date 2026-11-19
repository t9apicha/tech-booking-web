'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db, getSession, clearSession } from '@/lib/supabase';
import {
  LayoutDashboard,
  UserCheck,
  Briefcase,
  LogOut,
  Users,
  Clock,
  CalendarDays,
  CheckCircle2,
  Wind,
  Droplets,
  Zap,
  Wrench,
} from 'lucide-react';

interface AdminUser {
  AdminID: string;
  AdminName: string;
}

interface TechRecord {
  TechnicianID: string;
  TechnicianName: string;
  TechnicianPhone: string;
  CategoryID: string;
  approved: boolean;
  Provinces: { ProvinceName: string } | null;
  ServiceCategories: { MainCategory: string; CategoryName: string } | null;
}

interface AdminJobRecord {
  JobID: string;
  ProblemDetail: string;
  Status: string;
  PaymentStatus: string;
  PaymentAmount: number;
  PaymentMethod: string | null;
  CreatedAt: string;
  Customers: { CustomerName: string } | null;
  Technicians: { TechnicianName: string; CategoryID: string } | null;
}

interface CategoryRecord {
  CategoryID: string;
  MainCategory: string;
  CategoryName: string;
  CategoryPrice: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [section, setSection] = useState<'dashboard' | 'approve' | 'jobs'>('dashboard');
  const [selectedMainFilter, setSelectedMainFilter] = useState<string>('ทั้งหมด');

  const [techs, setTechs] = useState<TechRecord[]>([]);
  const [jobs, setJobs] = useState<AdminJobRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);

  const fetchAdminData = useCallback(async () => {
    const { data: techData } = await db
      .from('Technicians')
      .select('*, Provinces(ProvinceName), ServiceCategories(MainCategory, CategoryName)');
    if (techData) setTechs(techData as TechRecord[]);

    const { data: jobData } = await db
      .from('Jobs')
      .select('*, Customers(CustomerName), Technicians(TechnicianName, CategoryID)')
      .order('CreatedAt', { ascending: false });
    if (jobData) setJobs(jobData as AdminJobRecord[]);

    const { data: catData } = await db.from('ServiceCategories').select('*');
    if (catData) setCategories(catData as CategoryRecord[]);
  }, []);

  useEffect(() => {
    const session = getSession<AdminUser>('admin');
    if (!session) {
      router.push('/');
      return;
    }
    setAdmin(session);
    fetchAdminData();
  }, [router, fetchAdminData]);

  const handleApproveTech = async (techId: string) => {
    await db.from('Technicians').update({ approved: true }).eq('TechnicianID', techId);
    fetchAdminData();
  };

  const handleLogout = () => {
    clearSession();
    router.push('/');
  };

  if (!admin) return null;

  // รายชื่อประเภทช่างหลักทั้งหมด
  const mainCategories = Array.from(
    new Set(categories.map((c) => c.MainCategory).filter(Boolean))
  );
  const filterTabs = ['ทั้งหมด', ...mainCategories];

  // ฟังก์ชันหาประเภทช่างหลักจาก CategoryID
  const getMainCategoryByCatId = (catId?: string) => {
    if (!catId) return 'ไม่ระบุ';
    const found = categories.find((c) => c.CategoryID === catId);
    return found?.MainCategory || 'ไม่ระบุ';
  };

  // สถิติรวม
  const pendingCount = techs.filter((t) => !t.approved).length;
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const monthStr = now.toISOString().slice(0, 7);

  const todayJobsCount = jobs.filter((j) => j.CreatedAt.startsWith(todayStr)).length;
  const monthJobsCount = jobs.filter((j) => j.CreatedAt.startsWith(monthStr)).length;

  // กรองข้อมูลตามแท็บประเภทช่างที่เลือก
  const filteredCategories =
    selectedMainFilter === 'ทั้งหมด'
      ? categories
      : categories.filter((c) => c.MainCategory === selectedMainFilter);

  const filteredTechs =
    selectedMainFilter === 'ทั้งหมด'
      ? techs
      : techs.filter(
          (t) =>
            (t.ServiceCategories?.MainCategory || getMainCategoryByCatId(t.CategoryID)) ===
            selectedMainFilter
        );

  const filteredJobs =
    selectedMainFilter === 'ทั้งหมด'
      ? jobs
      : jobs.filter(
          (j) => getMainCategoryByCatId(j.Technicians?.CategoryID) === selectedMainFilter
        );

  const getMainIcon = (name: string) => {
    if (name.includes('แอร์')) return <Wind className="w-5 h-5 text-sky-600" />;
    if (name.includes('ประปา')) return <Droplets className="w-5 h-5 text-blue-600" />;
    if (name.includes('ไฟ')) return <Zap className="w-5 h-5 text-amber-500" />;
    return <Wrench className="w-5 h-5 text-slate-600" />;
  };

  const getMainBadgeColor = (name: string) => {
    if (name.includes('แอร์')) return 'bg-sky-100 text-sky-800 border-sky-200';
    if (name.includes('ประปา')) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (name.includes('ไฟ')) return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-200 p-5 flex flex-col shrink-0">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-white">Admin Panel</h1>
          <p className="text-xs text-slate-400 mt-1">ผู้ดูแล: {admin.AdminName}</p>
        </div>

        <nav className="space-y-1.5 flex-1">
          <button
            onClick={() => {
              setSection('dashboard');
              setSelectedMainFilter('ทั้งหมด');
            }}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
              section === 'dashboard' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" /> แดชบอร์ดภาพรวม
          </button>
          <button
            onClick={() => {
              setSection('approve');
              setSelectedMainFilter('ทั้งหมด');
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
              section === 'approve' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <UserCheck className="w-4 h-4" /> อนุมัติช่างใหม่
            </span>
            {pendingCount > 0 && (
              <span className="bg-amber-500 text-slate-900 text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setSection('jobs');
              setSelectedMainFilter('ทั้งหมด');
            }}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
              section === 'jobs' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'
            }`}
          >
            <Briefcase className="w-4 h-4" /> ประวัติงานและการชำระเงิน
          </button>
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-red-400 hover:bg-slate-800 rounded-xl transition"
        >
          <LogOut className="w-4 h-4" /> ออกจากระบบ
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto text-slate-800">
        {section === 'dashboard' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">ภาพรวมระบบจ้างช่าง</h2>

            {/* การ์ดสถิติรวม 4 ช่อง */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 text-sm">
                  <span>ช่างทั้งหมดในระบบ</span>
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-3xl font-bold text-slate-800 mt-2">{techs.length}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 text-sm">
                  <span>ช่างรออนุมัติ</span>
                  <Clock className="w-5 h-5 text-amber-500" />
                </div>
                <p className="text-3xl font-bold text-amber-500 mt-2">{pendingCount}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 text-sm">
                  <span>งานจ้างวันนี้</span>
                  <CalendarDays className="w-5 h-5 text-emerald-600" />
                </div>
                <p className="text-3xl font-bold text-emerald-600 mt-2">{todayJobsCount}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 text-sm">
                  <span>งานจ้างเดือนนี้</span>
                  <Briefcase className="w-5 h-5 text-indigo-600" />
                </div>
                <p className="text-3xl font-bold text-indigo-600 mt-2">{monthJobsCount}</p>
              </div>
            </div>

            {/* การ์ดสรุปแยกตามสายงานช่าง (ช่างแอร์ / ช่างประปา / ช่างไฟฟ้า) */}
            <div>
              <h3 className="font-bold text-base text-slate-700 mb-3">
                สรุปจำนวนช่างและงานจ้างแยกตามสายงาน
              </h3>
              <div className="grid sm:grid-cols-3 gap-4">
                {mainCategories.map((mc) => {
                  const techInGroup = techs.filter(
                    (t) =>
                      (t.ServiceCategories?.MainCategory ||
                        getMainCategoryByCatId(t.CategoryID)) === mc
                  );
                  const jobsInGroup = jobs.filter(
                    (j) => getMainCategoryByCatId(j.Technicians?.CategoryID) === mc
                  );
                  const revenueInGroup = jobsInGroup
                    .filter((j) => j.PaymentStatus === 'ชำระแล้ว')
                    .reduce((sum, j) => sum + j.PaymentAmount, 0);

                  return (
                    <div
                      key={mc}
                      className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-lg text-slate-800">{mc}</span>
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                          {getMainIcon(mc)}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-sm">
                        <div>
                          <p className="text-xs text-slate-500">จำนวนช่าง</p>
                          <p className="font-bold text-slate-800">{techInGroup.length} คน</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">งานจ้างทั้งหมด</p>
                          <p className="font-bold text-blue-600">{jobsInGroup.length} งาน</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500">
                        ยอดชำระสำเร็จ:{' '}
                        <strong className="text-emerald-600">
                          {revenueInGroup.toLocaleString()} บาท
                        </strong>
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ตารางสรุปแยกตามประเภทบริการย่อย + ปุ่มตัวกรอง */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="font-bold text-lg text-slate-800">
                  สรุปจำนวนการจ้างงานแยกตามประเภทงาน
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {filterTabs.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setSelectedMainFilter(tab)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                        selectedMainFilter === tab
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-700">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">ประเภทช่าง</th>
                      <th className="py-3 px-4">หมวดหมู่งาน / บริการ</th>
                      <th className="py-3 px-4">ราคามาตรฐาน</th>
                      <th className="py-3 px-4">จำนวนการจ้างงาน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCategories.map((c) => {
                      const count = jobs.filter(
                        (j) =>
                          j.ProblemDetail?.includes(c.CategoryName) ||
                          (!j.ProblemDetail?.startsWith('[') &&
                            j.Technicians?.CategoryID === c.CategoryID)
                      ).length;

                      return (
                        <tr key={c.CategoryID} className="hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${getMainBadgeColor(
                                c.MainCategory || ''
                              )}`}
                            >
                              {c.MainCategory || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-800">
                            {c.CategoryName}
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            {c.CategoryPrice.toLocaleString()} บาท
                          </td>
                          <td className="py-3 px-4 font-bold text-blue-600">{count} ครั้ง</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {section === 'approve' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-xl font-bold text-slate-800">จัดการและอนุมัติช่างสมัครใหม่</h2>
              <div className="flex flex-wrap gap-1.5">
                {filterTabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setSelectedMainFilter(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      selectedMainFilter === tab
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-700">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">รหัสช่าง</th>
                    <th className="py-3 px-4">ชื่อ-นามสกุล</th>
                    <th className="py-3 px-4">ประเภทช่าง</th>
                    <th className="py-3 px-4">บริการหลัก</th>
                    <th className="py-3 px-4">จังหวัด</th>
                    <th className="py-3 px-4">เบอร์โทร</th>
                    <th className="py-3 px-4">สถานะ</th>
                    <th className="py-3 px-4">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTechs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        ไม่พบรายชื่อช่างในหมวดหมู่นี้
                      </td>
                    </tr>
                  ) : (
                    filteredTechs.map((t) => {
                      const mainCat =
                        t.ServiceCategories?.MainCategory || getMainCategoryByCatId(t.CategoryID);
                      return (
                        <tr key={t.TechnicianID} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono text-slate-700">{t.TechnicianID}</td>
                          <td className="py-3 px-4 font-medium text-slate-800">
                            {t.TechnicianName}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${getMainBadgeColor(
                                mainCat
                              )}`}
                            >
                              {mainCat}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            {t.ServiceCategories?.CategoryName || '-'}
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            {t.Provinces?.ProvinceName || '-'}
                          </td>
                          <td className="py-3 px-4 text-slate-700">{t.TechnicianPhone}</td>
                          <td className="py-3 px-4">
                            {t.approved ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                                <CheckCircle2 className="w-4 h-4" /> อนุมัติแล้ว
                              </span>
                            ) : (
                              <span className="text-amber-600 font-medium">รออนุมัติ</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {!t.approved ? (
                              <button
                                onClick={() => handleApproveTech(t.TechnicianID)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition"
                              >
                                Accept (อนุมัติ)
                              </button>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {section === 'jobs' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-xl font-bold text-slate-800">ประวัติงานจ้างและการชำระเงิน</h2>
              <div className="flex flex-wrap gap-1.5">
                {filterTabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setSelectedMainFilter(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      selectedMainFilter === tab
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-700">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">รหัสงาน</th>
                    <th className="py-3 px-4">ประเภทช่าง</th>
                    <th className="py-3 px-4">ลูกค้า</th>
                    <th className="py-3 px-4">ช่างผู้รับงาน</th>
                    <th className="py-3 px-4">สถานะงาน</th>
                    <th className="py-3 px-4">ยอดเงิน</th>
                    <th className="py-3 px-4">การชำระเงิน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredJobs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        ไม่พบประวัติงานในหมวดหมู่นี้
                      </td>
                    </tr>
                  ) : (
                    filteredJobs.map((j) => {
                      const mainCat = getMainCategoryByCatId(j.Technicians?.CategoryID);
                      return (
                        <tr key={j.JobID} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono text-slate-700">{j.JobID}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${getMainBadgeColor(
                                mainCat
                              )}`}
                            >
                              {mainCat}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-800">
                            {j.Customers?.CustomerName || '-'}
                          </td>
                          <td className="py-3 px-4 text-slate-800">
                            {j.Technicians?.TechnicianName || '-'}
                          </td>
                          <td className="py-3 px-4 text-slate-700">{j.Status}</td>
                          <td className="py-3 px-4 font-medium text-slate-800">
                            {j.PaymentAmount.toLocaleString()} บาท
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={
                                j.PaymentStatus === 'ชำระแล้ว'
                                  ? 'text-emerald-600 font-semibold'
                                  : 'text-amber-600 font-semibold'
                              }
                            >
                              {j.PaymentStatus}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}