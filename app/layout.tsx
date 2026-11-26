import type { Metadata } from 'next';
import { Prompt } from 'next/font/google';
import './globals.css';

const prompt = Prompt({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ระบบจ้างช่างออนไลน์ | บริการซ่อมแอร์ ประปา ไฟฟ้า ครบวงจร',
  description: 'แพลตฟอร์มค้นหาและนัดหมายช่างมืออาชีพ ราคามาตรฐาน ตรวจสอบได้',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={`${prompt.className} antialiased bg-slate-50 text-slate-800`}>
        {children}
      </body>
    </html>
  );
}