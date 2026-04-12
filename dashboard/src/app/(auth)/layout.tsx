export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-950 via-indigo-900 to-purple-900 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-white text-3xl font-bold shadow-lg">
            ب
          </div>
          <h1 className="text-2xl font-bold text-white">بزار</h1>
          <p className="text-sm text-indigo-300">منصة التجارة الإلكترونية البحرينية</p>
        </div>
        <div className="rounded-2xl bg-white p-8 shadow-2xl">{children}</div>
        <p className="mt-6 text-center text-xs text-indigo-400">
          © {new Date().getFullYear()} BSMC.BH — جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  );
}
