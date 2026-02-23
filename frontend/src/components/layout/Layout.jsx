import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

const Layout = () => {
  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden">
      {/* Animated gradient background */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-emerald-50/60 via-teal-50/30 to-sky-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />

      {/* Floating glass orbs for depth - static to prevent flickering */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-4 w-96 h-96 bg-emerald-400/15 dark:bg-blue-500/5 rounded-full mix-blend-normal filter blur-3xl" style={{transform: 'translateZ(0)'}} />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-teal-400/12 dark:bg-indigo-500/5 rounded-full mix-blend-normal filter blur-3xl" style={{transform: 'translateZ(0)'}} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-400/10 dark:bg-purple-500/5 rounded-full mix-blend-normal filter blur-3xl" style={{transform: 'translateZ(0)'}} />
      </div>

      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
        <Outlet />
      </main>
      <footer className="glass-surface px-4 sm:px-6 lg:px-8 py-6 sm:py-8 text-center text-teal-800 dark:text-gray-300 border-t border-emerald-200/30 dark:border-white/10 text-xs sm:text-sm">
        <p>&copy; 

                  Made with ❤️ by Surya.
        </p>
      </footer>
    </div>
  );
};

export default Layout;
