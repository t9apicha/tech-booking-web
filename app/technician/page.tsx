'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db, getSession, clearSession } from '@/lib/supabase';
import {
  Wrench,
  Calendar,
  Star,
  LogOut,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Navigation,
  Play,
  Flag,
} from 'lucide-react';

interface TechUser {
  TechnicianID: string;
  TechnicianName: string;
}

interface TechJob {
  JobID: string;
  SlotID: number | null;
  ServiceAddress: string;
  ProblemDetail: string;
  Status: string;
  PaymentStatus: string;
  PaymentAmount: number;
  Customers: { CustomerName: string; CustomerPhone: string } | null;
  TechnicianSlots: { WorkDate: string; StartTime: string; EndTime: string } | null;
}

interface SlotRecord {
  SlotID: number;
  WorkDate: string;
  StartTime: string;
  EndTime: string;
  IsBooked: boolean;
}

interface ReviewRecord {
  ReviewID: number;
  Rating: number;
  Comment: string | null;
  Customers: { CustomerName: string } | null;
}

export default function TechnicianDashboard() {
  const router = useRouter();
  const [tech, setTech] = useState<TechUser | null>(null);
  const [activeTab, setActiveTab] = useState<'jobs' | 'slots' | 'reviews'>('jobs');

  const [jobs, setJobs] = useState<TechJob[]>([]);
  const [slots, setSlots] = useState<SlotRecord[]>([]);
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);

  // Add Slot form
  const [workDate, setWorkDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');

  const loadAllTechData = useCallback(async (techId: string) => {
    const { data: jobData } = await db
      .from('Jobs')
      .select('*, Customers(CustomerName, CustomerPhone), TechnicianSlots(WorkDate, StartTime, EndTime)')
      .eq('TechnicianID', techId)
      .order('CreatedAt', { ascending: false });
    if (jobData) setJobs(jobData as TechJob[]);

    const { data: slotData } = await db
      .from('TechnicianSlots')
      .select('*')
      .eq('TechnicianID', techId)
      .order('WorkDate', { ascending: true });
    if (slotData) setSlots(slotData as SlotRecord[]);

    const { data: revData } = await db
      .from('Reviews')
      .select('*, Customers(CustomerName)')
      .eq('TechnicianID', techId)
      .order('CreatedAt', { ascending: false });
    if (revData) setReviews(revData as ReviewRecord[]);
  }, []);

  useEffect(() => {
    const session = getSession<TechUser>('technician');
    if (!session) {
      router.push('/');
      return;
    }
    setTech(session);
    loadAllTechData(session.TechnicianID);
  }, [router, loadAllTechData]);

  const handleUpdateStatus = async (jobId: string, newStatus: string) => {
    if (!tech) return;
    const payload: Record<string, string> = { Status: newStatus };
    if (newStatus === 'เริ่มงาน') payload.StartedAt = new Date().toISOString();
    if (newStatus === 'เสร็จสิ้น') payload.CompletedAt = new Date().toISOString();

    await db.from('Jobs').update(payload).eq('JobID', jobId);
    loadAllTechData(tech.TechnicianID);
  };

  const handleCancelJob = async (job: TechJob) => {
    if (!tech || !confirm('ยืนยันการยกเลิกงานนี้?')) return;
    await db.from('Jobs').update({ Status: 'ยกเลิก' }).eq('JobID', job.JobID);
    if (job.SlotID) {
      await db.from('TechnicianSlots').update({ IsBooked: false }).eq('SlotID', job.SlotID);
    }
    loadAllTechData(tech.TechnicianID);
  };

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tech || !workDate) return;

    const { error } = await db.from('TechnicianSlots').insert([
      {
        TechnicianID: tech.TechnicianID,
        WorkDate: workDate,
        StartTime: `${startTime}:00+07:00`,
        EndTime: `${endTime}:00+07:00`,
        IsBooked: false,
      },
    ]);

    if (error) {
      alert('เพิ่มเวลาว่างไม่สำเร็จ: ' + error.message);
      return;
    }
    setWorkDate('');
    loadAllTechData(tech.TechnicianID);
  };

  const handleDeleteSlot = async (slotId: number) => {
    if (!tech) return;
    await db.from('TechnicianSlots').delete().eq('SlotID', slotId);
    loadAllTechData(tech.TechnicianID);
  };

  const handleLogout = () => {
    clearSession();
    router.push('/');
  };

  if (!tech) return null;

  const completedCount = jobs.filter((j) => j.Status === 'เสร็จสิ้น').length;
  const canceledCount = jobs.filter((j) => j.Status === 'ยกเลิก').length;
  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.Rating, 0) / reviews.length).toFixed(1)
      : '0.0';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <header className="bg-teal-700 text-white px-6 py-4 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Wrench className="w-6 h-6" />
            <span className="font-bold text-lg">ศูนย์บริการช่างซ่อม</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-teal-100">ช่าง: {tech.TechnicianName}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-teal-800 hover:bg-teal-900 px-3 py-1.5 rounded-lg text-sm transition"
            >
              <LogOut className="w-4 h-4" /> ออกจากระบบ
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {/* การ์ดสถิติ */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 text-center">
            <p className="text-xs text-slate-500">งานที่ทำสำเร็จ</p>
            <p className="text-2xl font-bold text-teal-600 mt-1">{completedCount}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 text-center">
            <p className="text-xs text-slate-500">งานที่ยกเลิก</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{canceledCount}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 text-center">
            <p className="text-xs text-slate-500">คะแนนรีวิวเฉลี่ย</p>
            <p className="text-2xl font-bold text-amber-500 mt-1 flex items-center justify-center gap-1">
              <Star className="w-5 h-5 fill-amber-400 text-amber-400" /> {avgRating}
            </p>
          </div>
        </div>

        {/* แถบเมนู */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('jobs')}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition ${
              activeTab === 'jobs'
                ? 'bg-teal-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            รายการงานจ้าง ({jobs.length})
          </button>
          <button
            onClick={() => setActiveTab('slots')}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition ${
              activeTab === 'slots'
                ? 'bg-teal-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            จัดการตารางเวลาว่าง ({slots.length})
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition ${
              activeTab === 'reviews'
                ? 'bg-teal-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            รีวิวจากลูกค้า ({reviews.length})
          </button>
        </div>

        {activeTab === 'jobs' && (
          <div className="space-y-4">
            {jobs.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl text-center text-slate-500">
                ยังไม่มีงานจ้างเข้ามาในขณะนี้
              </div>
            ) : (
              jobs.map((job) => (
                <div
                  key={job.JobID}
                  className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2"
                >
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <span className="font-bold text-slate-800">
                      งาน #{job.JobID} — ลูกค้า: {job.Customers?.CustomerName || '-'}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                      {job.Status}
                    </span>
                  </div>
                  <p className="text-sm">
                    <strong>เบอร์โทรลูกค้า:</strong> {job.Customers?.CustomerPhone || '-'}
                  </p>
                  <p className="text-sm">
                    <strong>วัน-เวลานัดหมาย:</strong>{' '}
                    {job.TechnicianSlots
                      ? `${job.TechnicianSlots.WorkDate} (${job.TechnicianSlots.StartTime.slice(0, 5)} - ${job.TechnicianSlots.EndTime.slice(0, 5)})`
                      : '-'}
                  </p>
                  <p className="text-sm">
                    <strong>สถานที่ปฏิบัติงาน:</strong> {job.ServiceAddress}
                  </p>
                  <p className="text-sm">
                    <strong>อาการเสีย:</strong> {job.ProblemDetail}
                  </p>
                  <p className="text-sm">
                    <strong>ค่าบริการ:</strong> {job.PaymentAmount.toLocaleString()} บาท (
                    {job.PaymentStatus})
                  </p>

                  <div className="pt-3 flex flex-wrap gap-2">
                    {job.Status === 'รอดำเนินการ' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(job.JobID, 'กำลังเดินทาง')}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl"
                        >
                          <Navigation className="w-4 h-4" /> กำลังเดินทาง
                        </button>
                        <button
                          onClick={() => handleCancelJob(job)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-xl"
                        >
                          <XCircle className="w-4 h-4" /> ยกเลิกงาน
                        </button>
                      </>
                    )}
                    {job.Status === 'กำลังเดินทาง' && (
                      <button
                        onClick={() => handleUpdateStatus(job.JobID, 'เริ่มงาน')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-xl"
                      >
                        <Play className="w-4 h-4" /> เริ่มงาน
                      </button>
                    )}
                    {job.Status === 'เริ่มงาน' && (
                      <button
                        onClick={() => handleUpdateStatus(job.JobID, 'เสร็จสิ้น')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-xl"
                      >
                        <Flag className="w-4 h-4" /> จบงาน
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'slots' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-6">
            <form onSubmit={handleAddSlot} className="grid sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">วันที่ว่าง</label>
                <input
                  type="date"
                  required
                  value={workDate}
                  onChange={(e) => setWorkDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">เวลาเริ่ม</label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">เวลาสิ้นสุด</label>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl"
              >
                <Plus className="w-4 h-4" /> เพิ่มคิวว่าง
              </button>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">วันที่</th>
                    <th className="py-3 px-4">ช่วงเวลา</th>
                    <th className="py-3 px-4">สถานะ</th>
                    <th className="py-3 px-4 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {slots.map((s) => (
                    <tr key={s.SlotID}>
                      <td className="py-3 px-4 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" /> {s.WorkDate}
                      </td>
                      <td className="py-3 px-4">
                        {s.StartTime.slice(0, 5)} - {s.EndTime.slice(0, 5)}
                      </td>
                      <td className="py-3 px-4">
                        {s.IsBooked ? (
                          <span className="text-red-600 font-medium">ถูกจองแล้ว</span>
                        ) : (
                          <span className="text-emerald-600 font-medium">ว่าง</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!s.IsBooked && (
                          <button
                            onClick={() => handleDeleteSlot(s.SlotID)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="ลบช่วงเวลา"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="space-y-4">
            {reviews.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl text-center text-slate-500">
                ยังไม่มีรีวิวจากลูกค้า
              </div>
            ) : (
              reviews.map((rev) => (
                <div
                  key={rev.ReviewID}
                  className="bg-white p-5 rounded-2xl border border-slate-200 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">
                      คุณ {rev.Customers?.CustomerName || 'ลูกค้า'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-amber-500 font-semibold text-sm">
                      <Star className="w-4 h-4 fill-amber-400" /> {rev.Rating} / 5
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{rev.Comment || 'ไม่มีความคิดเห็นเพิ่มเติม'}</p>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}