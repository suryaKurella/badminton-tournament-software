import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Users, Trophy, Lock, Globe, Pencil, Trash2, UserPlus, UserMinus, Shield, Crown, Check, X, LayoutGrid, List, MapPin, Calendar } from 'lucide-react';
import { clubAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSpinner, Button, ConfirmationModal, StatusBadge } from '../../components/common';

const ClubDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin, isAuthenticated, loading: authLoading } = useAuth();
  const toast = useToast();
  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tournaments');
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('clubTournamentViewMode') || 'card';
  });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  useEffect(() => {
    if (!authLoading) {
      fetchClub();
    }
  }, [id, authLoading]);

  const fetchClub = async () => {
    try {
      setLoading(true);
      const response = await clubAPI.getById(id);
      setClub(response.data.data);
    } catch (error) {
      console.error('Error fetching club:', error);
      if (error.response?.status === 403) {
        toast.error('You do not have access to this private club');
      } else if (error.response?.status === 404) {
        toast.error('Club not found');
      } else {
        toast.error('Failed to load club');
      }
      navigate('/clubs');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinClub = async () => {
    try {
      const response = await clubAPI.join(id);
      toast.success(response.data.message);
      fetchClub();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to join club');
    }
  };

  const handleLeaveClub = async () => {
    setConfirmModal({
      isOpen: true,
      title: 'Leave Club',
      message: 'Are you sure you want to leave this club?',
      type: 'warning',
      confirmText: 'Leave',
      onConfirm: async () => {
        try {
          await clubAPI.leave(id);
          toast.success('You have left the club');
          fetchClub();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to leave club');
        }
        setConfirmModal({ ...confirmModal, isOpen: false });
      },
    });
  };

  const handleApproveMembership = async (membershipId) => {
    try {
      await clubAPI.approveMembership(id, membershipId);
      toast.success('Membership approved');
      fetchClub();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to approve membership');
    }
  };

  const handleRejectMembership = async (membershipId) => {
    try {
      await clubAPI.rejectMembership(id, membershipId);
      toast.success('Membership rejected');
      fetchClub();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reject membership');
    }
  };

  const handleRemoveMember = async (membershipId, memberName) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remove Member',
      message: `Are you sure you want to remove ${memberName} from the club?`,
      type: 'danger',
      confirmText: 'Remove',
      onConfirm: async () => {
        try {
          await clubAPI.removeMember(id, membershipId);
          toast.success('Member removed');
          fetchClub();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to remove member');
        }
        setConfirmModal({ ...confirmModal, isOpen: false });
      },
    });
  };

  const handleUpdateRole = async (membershipId, newRole) => {
    try {
      await clubAPI.updateMemberRole(id, membershipId, newRole);
      toast.success(`Role updated to ${newRole}`);
      fetchClub();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update role');
    }
  };

  const handleDeleteClub = async () => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Club',
      message: `Are you sure you want to delete "${club.name}"? This action cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await clubAPI.delete(id);
          toast.success('Club deleted');
          navigate('/clubs');
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to delete club');
        }
        setConfirmModal({ ...confirmModal, isOpen: false });
      },
    });
  };

  if (authLoading || loading) {
    return <LoadingSpinner message="Loading club..." />;
  }

  if (!club) {
    return null;
  }

  const myMembership = club.myMembership;
  const isClubOwner = myMembership?.role === 'OWNER';
  const isClubAdmin = myMembership?.role === 'OWNER' || myMembership?.role === 'ADMIN';
  const isMember = myMembership?.status === 'APPROVED';
  const isPending = myMembership?.status === 'PENDING';
  const canManageMembers = isClubAdmin || isAdmin;
  const canDeleteClub = isClubOwner || user?.role === 'ROOT';

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getRoleBadge = (role) => {
    const styles = {
      OWNER: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
      ADMIN: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
      MEMBER: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
    };
    const icons = {
      OWNER: <Crown size={12} />,
      ADMIN: <Shield size={12} />,
      MEMBER: null,
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${styles[role]}`}>
        {icons[role]} {role}
      </span>
    );
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="glass-card p-6 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {club.name}
              </h1>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1.5 ${
                club.visibility === 'PUBLIC'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}>
                {club.visibility === 'PUBLIC' ? <Globe size={14} /> : <Lock size={14} />}
                {club.visibility}
              </span>
            </div>
            {club.description && (
              <p className="text-gray-600 dark:text-gray-400 mt-2">{club.description}</p>
            )}
            <div className="flex gap-6 mt-4 text-sm">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                <Users size={18} className="text-brand-blue" />
                <span><strong>{club.memberCount}</strong> members</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                <Trophy size={18} className="text-yellow-500" />
                <span><strong>{club.tournamentCount}</strong> tournaments</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {isAuthenticated && !myMembership && (
              <Button onClick={handleJoinClub} variant="primary">
                <UserPlus size={16} className="mr-2" />
                {club.visibility === 'PUBLIC' ? 'Join Club' : 'Request to Join'}
              </Button>
            )}
            {isPending && (
              <span className="px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg text-sm font-medium">
                Membership Pending
              </span>
            )}
            {isMember && !isClubOwner && (
              <Button onClick={handleLeaveClub} variant="secondary">
                <UserMinus size={16} className="mr-2" />
                Leave Club
              </Button>
            )}
            {(isClubAdmin || isAdmin) && (
              <Link to={`/clubs/${id}/edit`}>
                <Button variant="outline">
                  <Pencil size={16} className="mr-2" />
                  Edit
                </Button>
              </Link>
            )}
            {canDeleteClub && (
              <Button onClick={handleDeleteClub} variant="error">
                <Trash2 size={16} className="mr-2" />
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('tournaments')}
          className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
            activeTab === 'tournaments'
              ? 'bg-brand-blue text-white'
              : 'glass-surface text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
          }`}
        >
          Tournaments ({club.tournamentCount})
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
            activeTab === 'members'
              ? 'bg-brand-blue text-white'
              : 'glass-surface text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
          }`}
        >
          Members ({club.memberCount})
        </button>
        {canManageMembers && club.pendingMemberships?.length > 0 && (
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'pending'
                ? 'bg-brand-blue text-white'
                : 'glass-surface text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
            }`}
          >
            Pending ({club.pendingMemberships.length})
          </button>
        )}
      </div>

      {/* Tournaments Tab */}
      {activeTab === 'tournaments' && (
        <div>
          {/* View Toggle */}
          <div className="flex justify-end mb-4">
            <div className="flex gap-1 glass-surface p-1">
              <button
                onClick={() => {
                  setViewMode('card');
                  localStorage.setItem('clubTournamentViewMode', 'card');
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
                  localStorage.setItem('clubTournamentViewMode', 'list');
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

          {club.tournaments?.length === 0 ? (
            <div className="glass-card p-6">
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">No tournaments yet</p>
            </div>
          ) : viewMode === 'list' ? (
            /* List View */
            <div className="flex flex-col gap-3">
              {club.tournaments?.map((tournament) => (
                <Link
                  key={tournament.id}
                  to={`/tournaments/${tournament.id}`}
                  className="glass-card p-4 block hover:scale-[1.01] transition-transform"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
                          {tournament.name}
                        </h3>
                        <StatusBadge status={tournament.status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-medium bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                          {tournament.tournamentType}
                        </span>
                        <span className="font-medium bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                          {tournament.format?.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 sm:gap-6 text-sm">
                      <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                        <MapPin size={14} className="text-gray-400" />
                        <span className="truncate max-w-[120px]">{tournament.location}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                        <Calendar size={14} className="text-gray-400" />
                        <span>{formatDate(tournament.startDate)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                        <Users size={14} className="text-gray-400" />
                        <span>{tournament._count?.registrations || 0}/{tournament.maxParticipants}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            /* Card View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {club.tournaments?.map((tournament) => (
                <Link
                  key={tournament.id}
                  to={`/tournaments/${tournament.id}`}
                  className="glass-card p-5 sm:p-6 block hover:-translate-y-1"
                >
                  <div className="flex justify-between items-start mb-3 gap-3">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white leading-tight flex-1">
                      {tournament.name}
                    </h3>
                    <StatusBadge status={tournament.status} />
                  </div>

                  <div className="flex gap-3 mb-4 flex-wrap">
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold bg-gray-50 dark:bg-slate-700 px-3 py-1.5 rounded-md">
                      {tournament.tournamentType}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold bg-gray-50 dark:bg-slate-700 px-3 py-1.5 rounded-md">
                      {tournament.format?.replace('_', ' ')}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center gap-2.5 text-sm text-gray-900 dark:text-white">
                      <MapPin size={16} className="text-gray-400" />
                      <span>{tournament.location}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-sm text-gray-900 dark:text-white">
                      <Calendar size={16} className="text-gray-400" />
                      <span>{formatDate(tournament.startDate)}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-sm text-gray-900 dark:text-white">
                      <Users size={16} className="text-gray-400" />
                      <span>{tournament._count?.registrations || 0}/{tournament.maxParticipants}</span>
                    </div>
                  </div>

                  {tournament.description && (
                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed line-clamp-2 mt-4">
                      {tournament.description}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div className="glass-card p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Members</h2>
          {club.memberships?.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No members yet</p>
          ) : (
            <div className="space-y-3">
              {club.memberships?.map((membership) => (
                <div
                  key={membership.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-blue/20 flex items-center justify-center text-brand-blue font-bold">
                      {(membership.user.fullName || membership.user.username || 'U')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {membership.user.fullName || membership.user.username}
                      </p>
                      {membership.user.username && membership.user.fullName && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">@{membership.user.username}</p>
                      )}
                    </div>
                    {getRoleBadge(membership.role)}
                  </div>

                  {canManageMembers && membership.role !== 'OWNER' && membership.user.id !== user?.id && (
                    <div className="flex gap-2">
                      {isClubOwner && (
                        <select
                          value={membership.role}
                          onChange={(e) => handleUpdateRole(membership.id, e.target.value)}
                          className="text-sm glass-surface px-2 py-1 rounded"
                        >
                          <option value="MEMBER">Member</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      )}
                      <button
                        onClick={() => handleRemoveMember(membership.id, membership.user.fullName || membership.user.username)}
                        className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                        title="Remove member"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pending Tab */}
      {activeTab === 'pending' && canManageMembers && (
        <div className="glass-card p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Pending Requests</h2>
          {club.pendingMemberships?.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No pending requests</p>
          ) : (
            <div className="space-y-3">
              {club.pendingMemberships?.map((membership) => (
                <div
                  key={membership.id}
                  className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-600 font-bold">
                      {(membership.user.fullName || membership.user.username || 'U')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {membership.user.fullName || membership.user.username}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Requested {new Date(membership.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproveMembership(membership.id)}
                      className="p-2 text-green-600 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 rounded-lg"
                      title="Approve"
                    >
                      <Check size={18} />
                    </button>
                    <button
                      onClick={() => handleRejectMembership(membership.id)}
                      className="p-2 text-red-600 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg"
                      title="Reject"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText || 'Confirm'}
        type={confirmModal.type || 'primary'}
      />
    </div>
  );
};

export default ClubDetails;
