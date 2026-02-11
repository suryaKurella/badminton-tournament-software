import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { tournamentAPI } from '../../services/api';
import { Button, LoadingSpinner } from '../common';
import { Users, Shuffle, ChevronDown, Check, RefreshCw } from 'lucide-react';

const ManualGroupAssignment = ({ tournament, onAssignmentChange }) => {
  const [assignments, setAssignments] = useState(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(null);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [shuffling, setShuffling] = useState(false);

  useEffect(() => {
    fetchAssignments();
  }, [tournament.id]);

  const fetchAssignments = async () => {
    try {
      const response = await tournamentAPI.getGroupAssignments(tournament.id);
      setAssignments(response.data.data);
    } catch (error) {
      console.error('Error fetching group assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignToGroup = async (registrationId, groupName) => {
    setAssigning(registrationId);
    try {
      await tournamentAPI.assignToGroup(tournament.id, registrationId, groupName);
      await fetchAssignments();
      if (onAssignmentChange) {
        onAssignmentChange();
      }
    } catch (error) {
      console.error('Error assigning to group:', error);
      alert(error.response?.data?.message || 'Failed to assign player to group');
    } finally {
      setAssigning(null);
    }
  };

  const handleAutoAssign = async () => {
    setAutoAssigning(true);
    try {
      await tournamentAPI.autoAssignGroups(tournament.id);
      await fetchAssignments();
      if (onAssignmentChange) {
        onAssignmentChange();
      }
    } catch (error) {
      console.error('Error auto-assigning groups:', error);
      alert(error.response?.data?.message || 'Failed to auto-assign groups');
    } finally {
      setAutoAssigning(false);
    }
  };

  const handleShuffle = async () => {
    setShuffling(true);
    try {
      await tournamentAPI.shuffleGroups(tournament.id);
      await fetchAssignments();
      if (onAssignmentChange) {
        onAssignmentChange();
      }
    } catch (error) {
      console.error('Error shuffling groups:', error);
      alert(error.response?.data?.message || 'Failed to shuffle groups');
    } finally {
      setShuffling(false);
    }
  };

  const getPlayerName = (registration) => {
    return registration.user?.fullName || registration.user?.username || 'Unknown';
  };

  if (loading) {
    return <LoadingSpinner message="Loading group assignments..." />;
  }

  if (!assignments) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        Unable to load group assignments.
      </div>
    );
  }

  const { groups, unassigned, numberOfGroups, bracketGenerated } = assignments;
  const groupNames = Object.keys(groups).sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="text-brand-green" size={24} />
            Group Assignment
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Assign players to groups before starting the tournament
          </p>
        </div>

        {!bracketGenerated && (
          <div className="flex flex-wrap gap-2">
            {unassigned.length > 0 && (
              <Button
                onClick={handleAutoAssign}
                loading={autoAssigning}
                disabled={autoAssigning || shuffling}
                variant="secondary"
                className="flex items-center gap-2"
              >
                <Shuffle size={18} />
                Auto-Assign ({unassigned.length})
              </Button>
            )}
            {assignments.totalRegistrations > 0 && (
              <Button
                onClick={handleShuffle}
                loading={shuffling}
                disabled={shuffling || autoAssigning}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RefreshCw size={18} />
                Shuffle All
              </Button>
            )}
          </div>
        )}
      </div>

      {bracketGenerated && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 px-4 py-3 rounded-lg text-sm">
          Bracket has been generated. Reset the tournament to change group assignments.
        </div>
      )}

      {/* Unassigned Players */}
      {unassigned.length > 0 && !bracketGenerated && (
        <div className="glass-card p-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Unassigned Players ({unassigned.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((reg) => (
              <PlayerChip
                key={reg.id}
                registration={reg}
                groups={groupNames}
                onAssign={(groupName) => handleAssignToGroup(reg.id, groupName)}
                assigning={assigning === reg.id}
                disabled={bracketGenerated}
              />
            ))}
          </div>
        </div>
      )}

      {/* Groups Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {groupNames.map((groupName) => {
          const groupPlayers = groups[groupName] || [];
          return (
            <div key={groupName} className="glass-card overflow-hidden">
              <div className="bg-gradient-to-r from-brand-green/20 to-transparent p-3 border-b border-border">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Group {groupName}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {groupPlayers.length} players
                </p>
              </div>

              <div className="p-3 space-y-2 min-h-[100px]">
                {groupPlayers.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
                    No players assigned
                  </p>
                ) : (
                  groupPlayers.map((reg) => (
                    <PlayerChip
                      key={reg.id}
                      registration={reg}
                      groups={groupNames}
                      currentGroup={groupName}
                      onAssign={(newGroup) => handleAssignToGroup(reg.id, newGroup)}
                      assigning={assigning === reg.id}
                      disabled={bracketGenerated}
                      compact
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info */}
      <div className="text-xs text-gray-500 dark:text-gray-400">
        <p>
          Players are assigned to groups using snake seeding by default (1→A, 2→B, 3→C, 4→D, 5→D, 6→C...).
          You can manually reassign players by clicking on their name and selecting a group.
        </p>
      </div>
    </div>
  );
};

// Player chip component with dropdown to change group
const PlayerChip = ({ registration, groups, currentGroup, onAssign, assigning, disabled, compact }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const playerName = registration.user?.fullName || registration.user?.username || 'Unknown';

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
    setIsOpen(!isOpen);
  };

  if (disabled) {
    return (
      <div className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium ${
        compact
          ? 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 w-full'
          : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300'
      }`}>
        <span className="truncate">{playerName}</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        disabled={assigning}
        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
          compact
            ? 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 w-full justify-between'
            : 'bg-brand-green/10 text-brand-green hover:bg-brand-green/20'
        } ${assigning ? 'opacity-50' : ''}`}
      >
        <span className="truncate">{playerName}</span>
        {assigning ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <ChevronDown size={14} />
        )}
      </button>

      {isOpen && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />
          <div
            className="fixed z-[9999] bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 py-1 min-w-[120px]"
            style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
          >
            {groups.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">No groups available</div>
            ) : (
              groups.map((groupName) => (
                <button
                  key={groupName}
                  onClick={() => {
                    if (groupName !== currentGroup) {
                      onAssign(groupName);
                    }
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center justify-between ${
                    groupName === currentGroup ? 'text-brand-green font-medium' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Group {groupName}
                  {groupName === currentGroup && <Check size={14} />}
                </button>
              ))
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default ManualGroupAssignment;
