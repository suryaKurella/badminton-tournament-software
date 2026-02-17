import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { X, ChevronDown, Search, ArrowLeft } from 'lucide-react';
import { tournamentAPI, matchAPI, clubAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useFeatureFlag } from '../../context/FeatureFlagContext';
import { useToast } from '../../context/ToastContext';
import { Input, Select, Textarea, LoadingSpinner, Button, ConfirmationModal } from '../../components/common';

const TournamentEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isOrganizer, user } = useAuth();
  const doubleEliminationEnabled = useFeatureFlag('double_elimination');
  const toast = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    location: '',
    maxParticipants: '',
    tournamentType: 'SINGLES',
    format: 'SINGLE_ELIMINATION',
    scoringPermission: 'ANYONE',
    numberOfGroups: '4',
    advancingPerGroup: '2',
    clubId: '',
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [matches, setMatches] = useState([]);
  const [regeneratingBracket, setRegeneratingBracket] = useState(false);
  const [resettingTournament, setResettingTournament] = useState(false);
  const [tournament, setTournament] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Club selection state
  const [clubs, setClubs] = useState([]);
  const [clubSearch, setClubSearch] = useState('');
  const [clubDropdownOpen, setClubDropdownOpen] = useState(false);
  const [selectedClub, setSelectedClub] = useState(null);
  const clubDropdownRef = useRef(null);

  useEffect(() => {
    fetchTournament();
    fetchMatches();
    fetchClubs();
  }, [id]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (clubDropdownRef.current && !clubDropdownRef.current.contains(event.target)) {
        setClubDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchClubs = async () => {
    try {
      const response = await clubAPI.getAll();
      setClubs(response.data.data || []);
    } catch (error) {
      console.error('Error fetching clubs:', error);
    }
  };

  const filteredClubs = clubs.filter(club =>
    club.name.toLowerCase().includes(clubSearch.toLowerCase())
  );

  const handleClubSelect = (club) => {
    setSelectedClub(club);
    setFormData(prev => ({ ...prev, clubId: club.id }));
    setClubDropdownOpen(false);
    setClubSearch('');
  };

  const handleClubClear = () => {
    setSelectedClub(null);
    setFormData(prev => ({ ...prev, clubId: '' }));
    setClubSearch('');
  };

  const fetchMatches = async () => {
    try {
      const response = await matchAPI.getByTournament(id);
      setMatches(response.data.data);
    } catch (error) {
      console.error('Error fetching matches:', error);
    }
  };

  const fetchTournament = async () => {
    try {
      const response = await tournamentAPI.getById(id);
      const tournamentData = response.data.data;

      // Check authorization
      const isCreator = tournamentData.createdById === user?.id;
      if (!isCreator && !isOrganizer) {
        toast.error('You are not authorized to edit this tournament');
        navigate(`/tournaments/${id}`);
        return;
      }

      setTournament(tournamentData);

      // Format dates for datetime-local input
      const startDate = new Date(tournamentData.startDate).toISOString().slice(0, 16);
      const endDate = new Date(tournamentData.endDate).toISOString().slice(0, 16);

      setFormData({
        name: tournamentData.name || '',
        description: tournamentData.description || '',
        startDate,
        endDate,
        location: tournamentData.location || '',
        maxParticipants: tournamentData.maxParticipants || '',
        tournamentType: tournamentData.tournamentType || 'SINGLES',
        format: tournamentData.format || 'SINGLE_ELIMINATION',
        scoringPermission: tournamentData.scoringPermission || 'ANYONE',
        numberOfGroups: String(tournamentData.numberOfGroups || 4),
        advancingPerGroup: String(tournamentData.advancingPerGroup || 2),
        clubId: tournamentData.clubId || '',
      });

      // Set selected club if tournament has a club
      if (tournamentData.club) {
        setSelectedClub(tournamentData.club);
      }
    } catch (error) {
      console.error('Error fetching tournament:', error);
      setError('Failed to load tournament details');
      toast.error('Failed to load tournament');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await tournamentAPI.update(id, formData);
      toast.success('Tournament updated successfully');
      navigate(`/tournaments/${id}`);
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to update tournament';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegenerateBracket = async () => {
    const hasStartedMatches = matches.some(
      (match) => match.matchStatus === 'LIVE' || match.matchStatus === 'COMPLETED'
    );

    if (hasStartedMatches) {
      toast.error('Cannot regenerate bracket after matches have started');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Regenerate Bracket?',
      message: 'This will delete all existing matches and create new ones based on the current tournament format and registered players. This action cannot be undone.',
      confirmText: 'Regenerate',
      type: 'danger',
      onConfirm: async () => {
        setRegeneratingBracket(true);
        try {
          await tournamentAPI.regenerateBracket(id);
          toast.success('Bracket regenerated successfully');
          fetchMatches();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to regenerate bracket');
        } finally {
          setRegeneratingBracket(false);
          setConfirmModal({ ...confirmModal, isOpen: false });
        }
      },
    });
  };

  const handleResetTournament = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Reset Tournament?',
      message: `Are you sure you want to reset this tournament? This will delete all matches, teams, and brackets. Registrations will be preserved, and new players can register if space is available.`,
      confirmText: 'Reset Tournament',
      type: 'danger',
      onConfirm: async () => {
        setResettingTournament(true);
        try {
          await tournamentAPI.reset(id);
          toast.success('Tournament reset! Registrations are now open.');
          fetchTournament();
          fetchMatches();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to reset tournament');
        } finally {
          setResettingTournament(false);
          setConfirmModal({ ...confirmModal, isOpen: false });
        }
      },
    });
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading tournament..." />;
  }

  return (
    <div className="w-full">
      <div className="mb-6 sm:mb-8 pb-4 border-b-2 border-gray-200 dark:border-slate-700">
        <button
          onClick={() => navigate(`/tournaments/${id}`)}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-3 transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="text-sm font-medium">Back to Tournament</span>
        </button>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">Edit Tournament</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">Update the tournament details</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-md mb-6 border-l-4 border-red-600 dark:border-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass-card p-6 sm:p-8">
        <div className="mb-6">
          <Input
            label="Tournament Name"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="e.g., Summer Championship 2024"
          />
        </div>

        <div className="mb-6">
          <Textarea
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={4}
            placeholder="Describe the tournament..."
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <Select
            label={tournament?.bracketGenerated ? "Type (locked - reset tournament to change)" : "Type"}
            name="tournamentType"
            value={formData.tournamentType}
            onChange={handleChange}
            required
            disabled={tournament?.bracketGenerated}
          >
            <option value="SINGLES">Singles</option>
            <option value="DOUBLES">Doubles</option>
            <option value="MIXED">Mixed Doubles</option>
          </Select>

          <Select
            label={tournament?.bracketGenerated ? "Format (locked - reset tournament to change)" : "Format"}
            name="format"
            value={formData.format}
            onChange={handleChange}
            required
            disabled={tournament?.bracketGenerated}
          >
            <option value="SINGLE_ELIMINATION">Single Elimination</option>
            {doubleEliminationEnabled && (
              <option value="DOUBLE_ELIMINATION">Double Elimination</option>
            )}
            <option value="ROUND_ROBIN">Round Robin</option>
            <option value="GROUP_KNOCKOUT">Group Stage + Knockout</option>
          </Select>
        </div>

        {/* Group Stage Settings */}
        {formData.format === 'GROUP_KNOCKOUT' && (
          <div className="mb-6 p-4 glass-surface rounded-lg border border-border">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
              Group Stage Settings
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Players will be divided into groups for round-robin matches. Top players from each group advance to knockout rounds.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <Select
                label="Number of Groups"
                name="numberOfGroups"
                value={formData.numberOfGroups}
                onChange={handleChange}
                disabled={tournament?.bracketGenerated}
              >
                <option value="2">2 Groups (A, B)</option>
                <option value="3">3 Groups (A, B, C)</option>
                <option value="4">4 Groups (A, B, C, D)</option>
                <option value="5">5 Groups (A, B, C, D, E)</option>
                <option value="6">6 Groups (A, B, C, D, E, F)</option>
                <option value="7">7 Groups (A-G)</option>
                <option value="8">8 Groups (A-H)</option>
              </Select>

              <Select
                label="Advancing Per Group"
                name="advancingPerGroup"
                value={formData.advancingPerGroup}
                onChange={handleChange}
                disabled={tournament?.bracketGenerated}
              >
                <option value="1">Top 1</option>
                <option value="2">Top 2</option>
                <option value="3">Top 3</option>
                <option value="4">Top 4</option>
              </Select>
            </div>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Example: With {formData.numberOfGroups} groups and top {formData.advancingPerGroup} advancing,
              you'll have {parseInt(formData.numberOfGroups) * parseInt(formData.advancingPerGroup)} teams in the knockout stage.
            </p>
          </div>
        )}

        <div className="mb-6">
          <Input
            label="Location"
            type="text"
            name="location"
            value={formData.location}
            onChange={handleChange}
            required
            placeholder="e.g., Sports Arena, City Name"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <Input
            label="Start Date & Time"
            type="datetime-local"
            name="startDate"
            value={formData.startDate}
            onChange={handleChange}
            required
          />

          <Input
            label="End Date & Time"
            type="datetime-local"
            name="endDate"
            value={formData.endDate}
            onChange={handleChange}
            required
          />
        </div>

        <div className="mb-6">
          <Input
            label="Maximum Participants"
            type="number"
            name="maxParticipants"
            value={formData.maxParticipants}
            onChange={handleChange}
            required
            min="2"
            max="128"
            placeholder="e.g., 32"
          />
        </div>

        {/* Scoring Permissions Section */}
        <div className="mb-6 p-4 glass-surface rounded-lg border border-border">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            Scoring Permissions
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Control who can update match scores during the tournament.
          </p>
          <Select
            label="Who can update scores?"
            name="scoringPermission"
            value={formData.scoringPermission}
            onChange={(e) => setFormData({
              ...formData,
              scoringPermission: e.target.value,
            })}
          >
            <option value="ANYONE">Anyone (All logged-in users)</option>
            <option value="PARTICIPANTS">Participants Only (Players registered in tournament and organizers)</option>
            <option value="ORGANIZERS">Organizers Only (Admins and tournament organizers)</option>
          </Select>
        </div>

        {/* Club Selection */}
        <div className="mb-8">
          <label className="block mb-2 font-semibold text-gray-900 dark:text-white text-sm">
            Club (Optional)
          </label>
          <div className="relative" ref={clubDropdownRef}>
            {selectedClub ? (
              <div className="flex items-center justify-between w-full px-4 py-3 border-2 border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700">
                <span className="text-gray-900 dark:text-white">{selectedClub.name}</span>
                <button
                  type="button"
                  onClick={handleClubClear}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-full transition-colors"
                >
                  <X size={16} className="text-gray-500 dark:text-gray-400" />
                </button>
              </div>
            ) : (
              <div
                className="flex items-center justify-between w-full px-4 py-3 border-2 border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                onClick={() => setClubDropdownOpen(!clubDropdownOpen)}
              >
                <span className="text-gray-400 dark:text-gray-500">Select a club...</span>
                <ChevronDown size={20} className="text-gray-400" />
              </div>
            )}

            {clubDropdownOpen && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border-2 border-gray-300 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-hidden">
                <div className="p-2 border-b border-gray-200 dark:border-slate-700">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={clubSearch}
                      onChange={(e) => setClubSearch(e.target.value)}
                      placeholder="Search clubs..."
                      className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-md bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="overflow-y-auto max-h-48">
                  {filteredClubs.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {clubs.length === 0 ? 'No clubs available' : 'No clubs match your search'}
                    </div>
                  ) : (
                    filteredClubs.map(club => (
                      <div
                        key={club.id}
                        className="px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                        onClick={() => handleClubSelect(club)}
                      >
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {club.name}
                        </div>
                        {club.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {club.description}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Optionally associate this tournament with a club. Club members will see it in their club page.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <Button
            type="button"
            onClick={() => navigate(`/tournaments/${id}`)}
            variant="secondary"
            size="lg"
            className="sm:flex-1"
            fullWidth
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            loading={submitting}
            size="lg"
            className="sm:flex-1"
            fullWidth
          >
            {submitting ? 'Updating...' : 'Update Tournament'}
          </Button>
        </div>
      </form>

      {/* Bracket Management Section */}
      {(matches.length > 0 || tournament?.bracketGenerated || tournament?.status === 'ACTIVE' || tournament?.status === 'OPEN') && (
        <div className="glass-card p-6 sm:p-8 mt-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3">
            Bracket Management
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {tournament?.bracketGenerated
              ? 'If you changed the tournament format or need to recreate matches, you can regenerate the bracket. This will delete all existing matches that haven\'t started yet.'
              : 'Generate a bracket to start the tournament. Make sure all players are approved before generating.'}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={handleRegenerateBracket}
              disabled={regeneratingBracket || resettingTournament}
              loading={regeneratingBracket}
              variant={tournament?.bracketGenerated ? 'warning' : 'primary'}
              size="md"
            >
              {regeneratingBracket
                ? (tournament?.bracketGenerated ? 'Regenerating...' : 'Generating...')
                : (tournament?.bracketGenerated ? 'Regenerate Bracket' : 'Generate Bracket')}
            </Button>
            {(tournament?.bracketGenerated || tournament?.status === 'ACTIVE') && (
              <Button
                type="button"
                onClick={handleResetTournament}
                disabled={resettingTournament || regeneratingBracket}
                loading={resettingTournament}
                variant="error"
                size="md"
              >
                {resettingTournament ? 'Resetting...' : 'Reset Tournament'}
              </Button>
            )}
          </div>
          {(tournament?.bracketGenerated || tournament?.status === 'ACTIVE') && (
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-3">
              <strong>Reset Tournament</strong> will delete all matches, teams, and brackets but preserve registrations, allowing you to start fresh.
            </p>
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

export default TournamentEdit;
