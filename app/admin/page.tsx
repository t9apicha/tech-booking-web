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
  UserCog,
  CreditCard,
  AlertCircle,
  Loader2,
  RefreshCw,
  Star,
  MessageSquare,
  X,
} from 'lucide-react';

interface AdminUser {
  AdminID: string;
  AdminName?: string;
  AdminEmail?: string;
}

interface PendingProfileData {
  TechnicianName: string;
  TechnicianPhone: string;
  ProvinceID: string;
  ProvinceName: string;
  Address: string;
  TechnicianPassword?: string;
  CategoryIDs: string[];
  ServiceNames: string[];
  requestedAt: string;
}

interface TechnicianRow {
  TechnicianID: string;
  TechnicianName: string;
  TechnicianEmail?: string;
  TechnicianPhone: string;
  ProvinceID: string;
  CategoryID: string | null;
  Address: string;
  approved: boolean | null;
  pending_profile?: PendingProfileData | null;
}

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

interface TechnicianService {
  TechnicianID: string;
  CategoryID: string;
}

interface JobRow {
  JobID: string;
  CustomerID: string;
  TechnicianID: string;
  ServiceAddress: string;
  ProblemDetail: string;
  Status: string;
  PaymentStatus: string;
  PaymentAmount: number;
  CreatedAt?: string | null;
}

interface CustomerRow {
  CustomerID: string;
  CustomerName: string;
  CustomerPhone: string;
}

interface ReviewRow {
  ReviewID: number;
  JobID: string;
  CustomerID: string;
  TechnicianID: string;
  Rating: number;
  Comment: string | null;
  CreatedAt?: string | null;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [section, setSection] = useState<'dashboard' | 'approve' | 'jobs'>('dashboard');
  const [selectedMainFilter, setSelectedMainFilter] = useState<string>('ทั้งหมด');

  const [techs, setTechs] = useState<TechnicianRow[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [techServices, setTechServices] = useState<TechnicianService[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);

  const [selectedTechForReview, setSelectedTechForReview] = useState<TechnicianRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchAdminData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    const [techRes, provRes, catRes, tsRes, jobRes, custRes, revRes] = await Promise.all([
      db.from('Technicians').select('*'),
      db.from('Provinces').select('*'),
      db.from('ServiceCategories').select('*'),
      db.from('TechnicianServices').select('*'),
      db.from('Jobs').select('*'),
      db.from('Customers').select('*'),
      db.from('Reviews').select('*'),
    ]);

    if (techRes.error) {
      setErrorMsg(`ดึงข้อมูลช่างไม่สำเร็จ: ${techRes.error.message}`);
    } else {
      const rawTechs = (techRes.data as TechnicianRow[]) || [];
      const sorted = [...rawTechs].sort((a, b) => {
        const aPending = !a.approved || Boolean(a.pending_profile) ? 0 : 1;
        const bPending = !b.approved || Boolean(b.pending_profile) ? 0 : 1;
        return aPending - bPending;
      });
      setTechs(sorted);
    }

    if (provRes.data) setProvinces(provRes.data as Province[]);
    if (catRes.data) setCategories(catRes.data as ServiceCategory[]);
    if (tsRes.data) setTechServices(tsRes.data as TechnicianService[]);
    if (jobRes.data) {
      const rawJobs = (jobRes.data as JobRow[]) || [];
      const sortedJobs = [...rawJobs].sort((a, b) =>
        (b.CreatedAt || '').localeCompare(a.CreatedAt || '')
      );
      setJobs(sortedJobs);
    }
    if (custRes.data) setCustomers(custRes.data as CustomerRow[]);
    if (revRes.data) {
      const rawRevs = (revRes.data as ReviewRow[]) || [];
      const sortedRevs = [...rawRevs].sort((a, b) =>
        (b.CreatedAt || '').localeCompare(a.CreatedAt || '')
      );
      setReviews(sortedRevs);
    }

    setLoading(false);
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

  // อนุมัติช่างสมัครใหม่
  const handleApproveTech = async (tech: TechnicianRow) => {
    setProcessingId(tech.TechnicianID);
    const { error } = await db
      .from('Technicians')
      .update({ approved: true })
      .eq('TechnicianID', tech.TechnicianID);

    if (error) {
      alert('อนุมัติไม่สำเร็จ: ' + error.message);
      setProcessingId(null);
      return;
    }

    const existingLinks = techServices.filter((ts) => ts.TechnicianID === tech.TechnicianID);
    if (existingLinks.length === 0 && tech.CategoryID) {
      await db.from('TechnicianServices').insert([
        {
          TechnicianID: tech.TechnicianID,
          CategoryID: tech.CategoryID,
        },
      ]);
    }

    setProcessingId(null);
    fetchAdminData();
  };

  // ปฏิเสธช่างสมัครใหม่
  const handleRejectTech = async (tech: TechnicianRow) => {
    if (!window.confirm(`ยืนยันการปฏิเสธและลบข้อมูลช่าง "${tech.TechnicianName}" ใช่หรือไม่?`)) {
      return;
    }
    setProcessingId(tech.TechnicianID);
    await db.from('TechnicianServices').delete().eq('TechnicianID', tech.TechnicianID);
    const { error } = await db
      .from('Technicians')
      .delete()
      .eq('TechnicianID', tech.TechnicianID);

    if (error) {
      alert('ลบข้อมูลไม่สำเร็จ: ' + error.message);
    }
    setProcessingId(null);
    fetchAdminData();
  };

  // อนุมัติคำขอแก้ไขโปรไฟล์ช่าง
  const handleApproveProfileEdit = async (t: TechnicianRow) => {
    const pending = t.pending_profile;
    if (!pending) return;

    setProcessingId(t.TechnicianID);

    const updatePayload: Record<string, unknown> = {
      TechnicianName: pending.TechnicianName,
      TechnicianPhone: pending.TechnicianPhone,
      ProvinceID: pending.ProvinceID,
      Address: pending.Address,
      CategoryID: pending.CategoryIDs?.[0] || t.CategoryID,
      pending_profile: null,
    };

    if (pending.TechnicianPassword) {
      updatePayload.TechnicianPassword = pending.TechnicianPassword;
    }

    const { error } = await db
      .from('Technicians')
      .update(updatePayload)
      .eq('TechnicianID', t.TechnicianID);

    if (error) {
      alert('อนุมัติการแก้ไขข้อมูลไม่สำเร็จ: ' + error.message);
      setProcessingId(null);
      return;
    }

    if (pending.CategoryIDs && pending.CategoryIDs.length > 0) {
      await db.from('TechnicianServices').delete().eq('TechnicianID', t.TechnicianID);
      const newRows = pending.CategoryIDs.map((catId) => ({
        TechnicianID: t.TechnicianID,
        CategoryID: catId,
      }));
      await db.from('TechnicianServices').insert(newRows);
    }

    setProcessingId(null);
    fetchAdminData();
  };

  // ปฏิเสธคำขอแก้ไขโปรไฟล์ช่าง
  const handleRejectProfileEdit = async (techId: string) => {
    setProcessingId(techId);
    await db.from('Technicians').update({ pending_profile: null }).eq('TechnicianID', techId);
    setProcessingId(null);
    fetchAdminData();
  };

  const handleLogout = () => {
    clearSession();
    router.push('/');
  };

  if (!admin) return null;

  const mainCategories = Array.from(
    new Set(categories.map((c) => c.MainCategory).filter(Boolean))
  );
  const filterTabs = ['ทั้งหมด', ...mainCategories];

  const getMainCategoryByCatId = (catId?: string | null) => {
    if (!catId) return 'ไม่ระบุ';
    const found = categories.find((c) => c.CategoryID === catId);
    return found?.MainCategory || 'ไม่ระบุ';
  };

  const getTechMainCategories = (t: TechnicianRow): string[] => {
    const linkedCatIds = techServices
      .filter((ts) => ts.TechnicianID === t.TechnicianID)
      .map((ts) => ts.CategoryID);
    const effectiveIds =
      linkedCatIds.length > 0 ? linkedCatIds : t.CategoryID ? [t.CategoryID] : [];

    const mains = categories
      .filter((c) => effectiveIds.includes(c.CategoryID))
      .map((c) => c.MainCategory)
      .filter(Boolean);

    return mains.length > 0 ? Array.from(new Set(mains)) : [];
  };

  const getTechSubServices = (t: TechnicianRow): string[] => {
    const linkedCatIds = techServices
      .filter((ts) => ts.TechnicianID === t.TechnicianID)
      .map((ts) => ts.CategoryID);
    const effectiveIds =
      linkedCatIds.length > 0 ? linkedCatIds : t.CategoryID ? [t.CategoryID] : [];

    return categories
      .filter((c) => effectiveIds.includes(c.CategoryID))
      .map((c) => c.CategoryName)
      .filter(Boolean);
  };

  const getTechReviews = (techId: string) => {
    return reviews.filter((r) => r.TechnicianID === techId);
  };

  const getJobMainCategory = (j: JobRow): string => {
    const match = j.ProblemDetail?.match(/^\[([^\-\]]+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
    const tech = techs.find((t) => t.TechnicianID === j.TechnicianID);
    return getMainCategoryByCatId(tech?.CategoryID);
  };

  const pendingNewTechCount = techs.filter((t) => !t.approved).length;
  const pendingProfileEditTechs = techs.filter((t) => Boolean(t.pending_profile));
  const totalApprovalBadge = pendingNewTechCount + pendingProfileEditTechs.length;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const monthStr = now.toISOString().slice(0, 7);

  const todayJobsCount = jobs.filter((j) => j.CreatedAt?.startsWith(todayStr)).length;
  const monthJobsCount = jobs.filter((j) => j.CreatedAt?.startsWith(monthStr)).length;
  const totalPaidRevenue = jobs
    .filter((j) => j.PaymentStatus === 'ชำระแล้ว')
    .reduce((sum, j) => sum + (j.PaymentAmount || 0), 0);

  const filteredCategories =
    selectedMainFilter === 'ทั้งหมด'
      ? categories
      : categories.filter((c) => c.MainCategory === selectedMainFilter);

  const filteredTechs =
    selectedMainFilter === 'ทั้งหมด'
      ? techs
      : techs.filter((t) => getTechMainCategories(t).includes(selectedMainFilter));

  const filteredJobs =
    selectedMainFilter === 'ทั้งหมด'
      ? jobs
      : jobs.filter((j) => getJobMainCategory(j) === selectedMainFilter);

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

  // ข้อมูลสำหรับ Modal ดูรีวิวของช่างที่ถูกคลิก
  const modalTechReviews = selectedTechForReview
    ? getTechReviews(selectedTechForReview.TechnicianID)
    : [];
  const modalAvgRating =
    modalTechReviews.length > 0
      ? (
          modalTechReviews.reduce((sum, r) => sum + r.Rating, 0) / modalTechReviews.length
        ).toFixed(1)
      : '-';
  const modalCompletedJobs = selectedTechForReview
    ? jobs.filter(
        (j) =>
          j.TechnicianID === selectedTechForReview.TechnicianID && j.Status === 'เสร็จสิ้น'
      ).length
    : 0;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-200 p-5 flex flex-col shrink-0">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-white">Admin Panel</h1>
          <p className="text-xs text-slate-400 mt-1">
            ผู้ดูแล: {admin.AdminName || admin.AdminEmail || 'Admin'}
          </p>
        </div>

        <nav className="space-y-1.5 flex-1">
          <button
            onClick={() => {
              setSection('dashboard');
              setSelectedMainFilter('ทั้งหมด');
            }}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
              section === 'dashboard' ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-slate-800'
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
              section === 'approve' ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <UserCheck className="w-4 h-4" /> จัดการช่าง & รีวิว
            </span>
            {totalApprovalBadge > 0 && (
              <span className="bg-amber-500 text-slate-900 text-xs font-bold px-2 py-0.5 rounded-full">
                {totalApprovalBadge}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setSection('jobs');
              setSelectedMainFilter('ทั้งหมด');
            }}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
              section === 'jobs' ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-slate-800'
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
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ส่วนที่ 1: แดชบอร์ดภาพรวม */}
        {section === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <h2 className="text-2xl font-bold text-slate-800">ภาพรวมระบบจ้างช่าง</h2>
                <button
                  onClick={fetchAdminData}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 transition"
                  title="รีเฟรชข้อมูล"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm text-sm">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span className="text-slate-500">ยอดชำระสำเร็จรวม:</span>
                <strong className="text-emerald-600">
                  {totalPaidRevenue.toLocaleString()} บาท
                </strong>
              </div>
            </div>

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
                  <span>รออนุมัติ / ขอแก้ข้อมูล</span>
                  <Clock className="w-5 h-5 text-amber-500" />
                </div>
                <p className="text-3xl font-bold text-amber-500 mt-2">{totalApprovalBadge}</p>
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

            {/* การ์ดสรุปแยกตามสายงานช่าง */}
            <div>
              <h3 className="font-bold text-base text-slate-700 mb-3">
                สรุปจำนวนช่างและงานจ้างแยกตามสายงาน
              </h3>
              <div className="grid sm:grid-cols-3 gap-4">
                {mainCategories.map((mc) => {
                  const techInGroup = techs.filter((t) => getTechMainCategories(t).includes(mc));
                  const jobsInGroup = jobs.filter((j) => getJobMainCategory(j) === mc);
                  const revenueInGroup = jobsInGroup
                    .filter((j) => j.PaymentStatus === 'ชำระแล้ว')
                    .reduce((sum, j) => sum + (j.PaymentAmount || 0), 0);

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
                          <p className="text-xs text-slate-500">ช่างที่รับสายงานนี้</p>
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

            {/* ตารางสรุปแยกตามประเภทบริการย่อย */}
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
                      const count = jobs.filter((j) => {
                        const tech = techs.find((t) => t.TechnicianID === j.TechnicianID);
                        return (
                          j.ProblemDetail?.includes(c.CategoryName) ||
                          (!j.ProblemDetail?.startsWith('[') && tech?.CategoryID === c.CategoryID)
                        );
                      }).length;

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

        {/* ส่วนที่ 2: จัดการช่าง อนุมัติ และดูรีวิวรายบุคคล */}
        {section === 'approve' && (
          <div className="space-y-6">
            {/* คำขอแก้ไขโปรไฟล์ช่างรออนุมัติ */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <UserCog className="w-5 h-5 text-amber-600" />
                  คำขอแก้ไขข้อมูลโปรไฟล์ช่าง ({pendingProfileEditTechs.length})
                </h2>
              </div>

              {pendingProfileEditTechs.length === 0 ? (
                <p className="text-sm text-slate-500 bg-slate-50 p-4 rounded-xl">
                  ไม่มีคำขอแก้ไขโปรไฟล์ช่างที่รออนุมัติในขณะนี้
                </p>
              ) : (
                <div className="space-y-4">
                  {pendingProfileEditTechs.map((t) => {
                    const req = t.pending_profile!;
                    const provName =
                      provinces.find((p) => p.ProvinceID === t.ProvinceID)?.ProvinceName || '-';
                    const oldServices = getTechSubServices(t).join(', ') || '-';
                    const newServices = req.ServiceNames?.join(', ') || '-';
                    const isBusy = processingId === t.TechnicianID;

                    return (
                      <div
                        key={t.TechnicianID}
                        className="p-5 rounded-xl border-2 border-amber-200 bg-amber-50/40 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 pb-2.5">
                          <div>
                            <span className="font-mono text-xs bg-slate-800 text-white px-2 py-0.5 rounded mr-2">
                              {t.TechnicianID}
                            </span>
                            <span className="font-bold text-slate-800">{t.TechnicianName}</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApproveProfileEdit(t)}
                              disabled={isBusy}
                              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
                            >
                              อนุมัติการเปลี่ยน
                            </button>
                            <button
                              onClick={() => handleRejectProfileEdit(t.TechnicianID)}
                              disabled={isBusy}
                              className="px-4 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold rounded-lg transition disabled:opacity-50"
                            >
                              ปฏิเสธ
                            </button>
                          </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4 text-xs">
                          <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-1">
                            <p className="font-bold text-slate-500 mb-1.5">ข้อมูลปัจจุบัน (เดิม)</p>
                            <p>
                              <strong>ชื่อ:</strong> {t.TechnicianName}
                            </p>
                            <p>
                              <strong>เบอร์โทร:</strong> {t.TechnicianPhone}
                            </p>
                            <p>
                              <strong>จังหวัด:</strong> {provName}
                            </p>
                            <p>
                              <strong>ที่อยู่:</strong> {t.Address}
                            </p>
                            <p>
                              <strong>บริการที่รับทำ:</strong> {oldServices}
                            </p>
                          </div>

                          <div className="bg-emerald-50/70 p-3.5 rounded-lg border border-emerald-200 space-y-1">
                            <p className="font-bold text-emerald-700 mb-1.5">
                              ข้อมูลใหม่ที่ขอเปลี่ยนแปลง
                            </p>
                            <p>
                              <strong>ชื่อ:</strong> {req.TechnicianName}
                            </p>
                            <p>
                              <strong>เบอร์โทร:</strong> {req.TechnicianPhone}
                            </p>
                            <p>
                              <strong>จังหวัด:</strong> {req.ProvinceName}
                            </p>
                            <p>
                              <strong>ที่อยู่:</strong> {req.Address}
                            </p>
                            <p>
                              <strong>บริการที่รับทำ:</strong> {newServices}
                            </p>
                            {req.TechnicianPassword && (
                              <p className="text-amber-700 font-semibold">
                                * มีการขอเปลี่ยนรหัสผ่านใหม่ด้วย
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ตารางรายชื่อช่างทั้งหมด (คลิกที่ชื่อช่างเพื่อดูรีวิวได้ทันที) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-bold text-slate-800">
                      รายชื่อช่างและการอนุมัติ
                    </h2>
                    <button
                      onClick={fetchAdminData}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
                      title="รีเฟรชรายชื่อช่าง"
                    >
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    คลิกที่ชื่อช่างหรือป้ายคะแนนดาวเพื่อดูรีวิวและความคิดเห็นจากลูกค้า
                  </p>
                </div>

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

              {loading ? (
                <div className="py-10 text-center text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" /> กำลังโหลดรายชื่อช่าง...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-slate-700">
                    <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">รหัสช่าง</th>
                        <th className="py-3 px-4">ชื่อ-นามสกุล (คลิกดูรีวิว)</th>
                        <th className="py-3 px-4">ประเภทช่าง</th>
                        <th className="py-3 px-4">บริการที่รับทำ</th>
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
                          const mainCats = getTechMainCategories(t);
                          const subServices = getTechSubServices(t);
                          const provName =
                            provinces.find((p) => p.ProvinceID === t.ProvinceID)?.ProvinceName ||
                            '-';
                          const isBusy = processingId === t.TechnicianID;

                          const techRevs = getTechReviews(t.TechnicianID);
                          const avgScore =
                            techRevs.length > 0
                              ? (
                                  techRevs.reduce((s, r) => s + r.Rating, 0) / techRevs.length
                                ).toFixed(1)
                              : null;

                          return (
                            <tr key={t.TechnicianID} className="hover:bg-slate-50 transition">
                              <td className="py-3 px-4 font-mono text-slate-700">
                                {t.TechnicianID}
                              </td>
                              <td className="py-3 px-4">
                                <button
                                  type="button"
                                  onClick={() => setSelectedTechForReview(t)}
                                  className="text-left group"
                                >
                                  <div className="font-semibold text-blue-700 group-hover:underline">
                                    {t.TechnicianName}
                                  </div>
                                  <div className="mt-1 flex items-center gap-1.5">
                                    {avgScore ? (
                                      <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-medium group-hover:bg-amber-100 transition">
                                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                        {avgScore} ({techRevs.length} รีวิว)
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full group-hover:bg-slate-200 transition">
                                        <MessageSquare className="w-3 h-3" /> ยังไม่มีรีวิว
                                      </span>
                                    )}
                                  </div>
                                </button>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex flex-wrap gap-1">
                                  {mainCats.length > 0
                                    ? mainCats.map((mc) => (
                                        <span
                                          key={mc}
                                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${getMainBadgeColor(
                                            mc
                                          )}`}
                                        >
                                          {mc}
                                        </span>
                                      ))
                                    : '-'}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-slate-700">
                                {subServices.length > 0 ? subServices.join(', ') : '-'}
                              </td>
                              <td className="py-3 px-4 text-slate-700">{provName}</td>
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
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => handleApproveTech(t)}
                                      disabled={isBusy}
                                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
                                    >
                                      อนุมัติ
                                    </button>
                                    <button
                                      onClick={() => handleRejectTech(t)}
                                      disabled={isBusy}
                                      className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg transition disabled:opacity-50"
                                    >
                                      ปฏิเสธ
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedTechForReview(t)}
                                    className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 text-xs font-medium rounded-lg transition"
                                  >
                                    ดูรีวิว ({techRevs.length})
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ส่วนที่ 3: ประวัติงานและการชำระเงิน */}
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
                      const mainCat = getJobMainCategory(j);
                      const cust = customers.find((c) => c.CustomerID === j.CustomerID);
                      const tech = techs.find((t) => t.TechnicianID === j.TechnicianID);

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
                            {cust?.CustomerName || j.CustomerID || '-'}
                          </td>
                          <td className="py-3 px-4 text-slate-800">
                            {tech?.TechnicianName || j.TechnicianID || '-'}
                          </td>
                          <td className="py-3 px-4 text-slate-700">{j.Status}</td>
                          <td className="py-3 px-4 font-medium text-slate-800">
                            {(j.PaymentAmount || 0).toLocaleString()} บาท
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

      {/* Modal แสดงรีวิวทั้งหมดของช่างที่กดเลือก */}
      {selectedTechForReview && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedTechForReview(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ส่วนหัว Modal */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold">{selectedTechForReview.TechnicianName}</h3>
                  <span className="font-mono text-xs bg-slate-700 text-slate-200 px-2 py-0.5 rounded">
                    {selectedTechForReview.TechnicianID}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  สายงาน: {getTechMainCategories(selectedTechForReview).join(', ') || '-'} • บริการ:{' '}
                  {getTechSubServices(selectedTechForReview).join(', ') || '-'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTechForReview(null)}
                className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* สรุปคะแนนและสถิติของช่าง */}
            <div className="grid grid-cols-3 gap-3 p-5 bg-slate-50 border-b border-slate-200">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center">
                <p className="text-xs text-slate-500">คะแนนรีวิวเฉลี่ย</p>
                <p className="text-2xl font-bold text-amber-500 mt-1 flex items-center justify-center gap-1">
                  <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                  {modalAvgRating}
                </p>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center">
                <p className="text-xs text-slate-500">จำนวนรีวิวทั้งหมด</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">
                  {modalTechReviews.length} <span className="text-xs font-normal">รายการ</span>
                </p>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center">
                <p className="text-xs text-slate-500">งานที่ทำเสร็จสิ้น</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">
                  {modalCompletedJobs} <span className="text-xs font-normal">งาน</span>
                </p>
              </div>
            </div>

            {/* รายการรีวิวจากลูกค้า */}
            <div className="p-6 overflow-y-auto space-y-3 flex-1">
              <h4 className="font-bold text-sm text-slate-700">
                ความคิดเห็นและคะแนนจากลูกค้า ({modalTechReviews.length})
              </h4>

              {modalTechReviews.length === 0 ? (
                <div className="py-10 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm">
                  ช่างคนนี้ยังไม่มีประวัติการรีวิวจากลูกค้า
                </div>
              ) : (
                modalTechReviews.map((rev) => {
                  const cust = customers.find((c) => c.CustomerID === rev.CustomerID);
                  const dateLabel = rev.CreatedAt ? rev.CreatedAt.slice(0, 10) : '';

                  return (
                    <div
                      key={rev.ReviewID}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-800">
                            {cust?.CustomerName || rev.CustomerID || 'ลูกค้า'}
                          </span>
                          <span className="font-mono text-[11px] bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded">
                            งาน {rev.JobID}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((starIdx) => (
                            <Star
                              key={starIdx}
                              className={`w-4 h-4 ${
                                starIdx <= rev.Rating
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-300'
                              }`}
                            />
                          ))}
                          <span className="text-xs font-bold text-slate-700 ml-1">
                            ({rev.Rating}/5)
                          </span>
                        </div>
                      </div>

                      <p className="text-sm text-slate-600 leading-relaxed">
                        {rev.Comment || 'ไม่ได้ระบุความคิดเห็นเพิ่มเติม'}
                      </p>

                      {dateLabel && (
                        <p className="text-[11px] text-slate-400 text-right">
                          วันที่รีวิว: {dateLabel}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* ส่วนท้าย Modal */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedTechForReview(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-xl transition"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}