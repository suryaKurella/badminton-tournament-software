import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

const Layout = () => {
  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden">
      {/* Animated gradient background */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-blue-50/50 via-white to-indigo-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />

      {/* Floating glass orbs for depth */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-4 w-96 h-96 bg-blue-400/10 dark:bg-blue-500/5 rounded-full mix-blend-normal filter blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-indigo-400/10 dark:bg-indigo-500/5 rounded-full mix-blend-normal filter blur-3xl animate-pulse" style={{animationDelay: '2s'}} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-400/8 dark:bg-purple-500/5 rounded-full mix-blend-normal filter blur-3xl animate-pulse" style={{animationDelay: '4s'}} />
      </div>

      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
        <Outlet />
      </main>
      <footer className="glass-surface px-4 sm:px-6 lg:px-8 py-6 sm:py-8 text-center text-gray-700 dark:text-gray-300 border-t border-white/20 dark:border-white/10 text-xs sm:text-sm">
        <p>&copy; 

                  Made with ❤️ by Surya.
        </p>
      </footer>
    </div>
  );
};

export default Layout;
