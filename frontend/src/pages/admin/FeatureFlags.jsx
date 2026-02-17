import { useState, useEffect } from 'react';
import { featureFlagAPI } from '../../services/api';
import { useFeatureFlags } from '../../context/FeatureFlagContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSpinner } from '../../components/common';

const FLAG_DESCRIPTIONS = {
  double_elimination: 'Show Double Elimination as a format option when creating or editing tournaments',
  live_scoring: 'Enable real-time point-by-point scoring for matches',
  club_features: 'Show the Clubs section in navigation and enable club management',
  tournament_structure_preview: 'Show the visual bracket/structure preview on tournament details',
  match_deletion: 'Allow admins to delete individual matches from tournaments',
  leaderboard: 'Show the Leaderboard in navigation and enable global rankings',
  admin_player_registration: 'Allow admins to directly register players/teams into tournaments',
};

const FeatureFlags = () => {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);
  const { refetchFlags } = useFeatureFlags();
  const toast = useToast();

  const fetchFlags = async () => {
    try {
      const response = await featureFlagAPI.getAllAdmin();
      setFlags(response.data.data || []);
    } catch (error) {
      toast.error('Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlags();
  }, []);

  const handleToggle = async (flag) => {
    setToggling(flag.name);
    try {
      await featureFlagAPI.update(flag.name, !flag.enabled);
      setFlags(prev => prev.map(f =>
        f.name === flag.name ? { ...f, enabled: !f.enabled } : f
      ));
      await refetchFlags();
      toast.success(`${flag.name} ${!flag.enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error(`Failed to update ${flag.name}`);
    } finally {
      setToggling(null);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading feature flags..." />;
  }

  return (
    <div className="w-full">
      <div className="mb-6 sm:mb-8 pb-4 border-b-2 border-gray-200 dark:border-slate-700">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">Feature Flags</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">Toggle features on or off across the application</p>
      </div>

      <div className="space-y-3">
        {flags.map((flag) => (
          <div
            key={flag.id}
            className="glass-card p-4 sm:p-5 flex items-center justify-between gap-4"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white font-mono">
                  {flag.name}
                </h3>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  flag.enabled
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  {flag.enabled ? 'ON' : 'OFF'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                {FLAG_DESCRIPTIONS[flag.name] || flag.description || 'No description'}
              </p>
            </div>

            <button
              onClick={() => handleToggle(flag)}
              disabled={toggling === flag.name}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-green focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 ${
                flag.enabled ? 'bg-brand-green' : 'bg-gray-300 dark:bg-slate-600'
              }`}
              role="switch"
              aria-checked={flag.enabled}
              aria-label={`Toggle ${flag.name}`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  flag.enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      {flags.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No feature flags found. Run the seed script to initialize them.
        </div>
      )}
    </div>
  );
};

export default FeatureFlags;
