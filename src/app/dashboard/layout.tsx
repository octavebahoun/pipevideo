import Sidebar from '@/components/Sidebar';
import AIAssistant from '@/components/AIAssistant';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <Sidebar />
      <main className="flex-1 relative">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-3xl animate-pulse-slow -z-10" />
        {children}
      </main>
      <AIAssistant />
    </div>
  );
}
