import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Trophy, Lock, Globe, LayoutGrid, List, Search } from 'lucide-react';
import { clubAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSpinner, Button } from '../../components/common';

const ClubList = () => {
  const { isAdmin, isAuthenticated, loading: authLoading } = useAuth();
  const toast = useToast();
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('clubViewMode') || 'card';
  });

  useEffect(() => {
    if (!authLoading) {
      fetchClubs();
    }
  }, [filter, authLoading]);

  const fetchClubs = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter !== 'all') {
        params.visibility = filter;
      }
      if (search) {
        params.search = search;
      }
      const response = await clubAPI.getAll(params);
      setClubs(response.data.data);
    } catch (error) {
      console.error('Error fetching clubs:', error);
      toast.error('Failed to load clubs');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchClubs();
  };

  if (authLoading || loading) {
    return <LoadingSpinner message="Loading clubs..." />;
  }

  // Card View
  const renderClubCard = (club) => (
    <Link
      to={`/clubs/${club.id}`}
      key={club.id}
      className="glass-card p-5 sm:p-6 block hover:-translate-y-1 relative"
    >
      <div className="flex justify-between items-start mb-3 gap-3">
        <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white leading-tight flex-1">
          {club.name}
        </h3>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
          club.visibility === 'PUBLIC'
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
        }`}>
          {club.visibility === 'PUBLIC' ? (
            <span className="flex items-center gap-1"><Globe size={12} /> Public</span>
          ) : (
            <span className="flex items-center gap-1"><Lock size={12} /> Private</span>
          )}
        </span>
      </div>

      {club.description && (
        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed line-clamp-2 mb-4">
          {club.description}
        </p>
      )}

      <div className="flex gap-4 mt-4">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <Users size={16} className="text-brand-blue" />
          <span>{club.memberCount} members</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <Trophy size={16} className="text-yellow-500" />
          <span>{club.tournamentCount} tournaments</span>
        </div>
      </div>

      {club.createdBy && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
          Created by {club.createdBy.fullName || club.createdBy.username}
        </p>
      )}
    </Link>
  );

  // List View
  const renderClubListItem = (club) => (
    <Link
      to={`/clubs/${club.id}`}
      key={club.id}
      className="glass-card p-4 block hover:scale-[1.01] transition-transform"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
              {club.name}
            </h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              club.visibility === 'PUBLIC'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}>
              {club.visibility === 'PUBLIC' ? 'Public' : 'Private'}
            </span>
          </div>
          {club.description && (
            <p className="text-gray-500 dark:text-gray-400 text-sm truncate mt-1">
              {club.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
            <Users size={14} className="text-gray-400" />
            <span>{club.memberCount}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
            <Trophy size={14} className="text-gray-400" />
            <span>{club.tournamentCount}</span>
          </div>
        </div>
      </div>
    </Link>
  );

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8 pb-4 border-b-2 border-gray-200 dark:border-slate-700">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">Clubs</h1>
        {isAdmin && (
          <Link to="/clubs/create">
            <Button variant="outline" size="md">
              Create Club
            </Button>
          </Link>
        )}
      </div>

      <div className="mb-6 sm:mb-8 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-4 items-center">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="glass-surface w-full sm:w-auto px-4 sm:px-5 py-2.5 text-sm text-gray-900 dark:text-white cursor-pointer font-medium focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
          >
            <option value="all">All Clubs</option>
            <option value="PUBLIC">Public</option>
            <option value="PRIVATE">Private</option>
          </select>

          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search clubs..."
                className="glass-surface pl-9 pr-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 w-48"
              />
            </div>
            <Button type="submit" variant="secondary" size="sm">
              Search
            </Button>
          </form>
        </div>

        {/* View Toggle */}
        <div className="flex gap-1 glass-surface p-1">
          <button
            onClick={() => {
              setViewMode('card');
              localStorage.setItem('clubViewMode', 'card');
            }}
            className={`p-2 rounded-lg transition-all ${
              viewMode === 'card'
                ? 'bg-brand-blue text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
            title="Card view"
          >
            <LayoutGrid size={18} />
          </button>
          <button
            onClick={() => {
              setViewMode('list');
              localStorage.setItem('clubViewMode', 'list');
            }}
            className={`p-2 rounded-lg transition-all ${
              viewMode === 'list'
                ? 'bg-brand-blue text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
            title="List view"
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {clubs.length === 0 ? (
        <div className="text-center py-16">
          <Users size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
            {search ? 'No clubs found matching your search' : 'No clubs found'}
          </p>
          {isAdmin && !search && (
            <Link to="/clubs/create" className="inline-block mt-4">
              <Button variant="outline">Create the first club</Button>
            </Link>
          )}
        </div>
      ) : viewMode === 'list' ? (
        <div className="flex flex-col gap-3">
          {clubs.map(renderClubListItem)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clubs.map(renderClubCard)}
        </div>
      )}

      {/* My Clubs Section */}
      {isAuthenticated && (
        <div className="mt-8">
          <Link to="/clubs?filter=my-clubs" className="text-brand-blue hover:underline text-sm font-medium">
            View My Clubs →
          </Link>
        </div>
      )}
    </div>
  );
};

export default ClubList;
