import { useState, useEffect } from 'react';
import SingleEliminationBracket from './SingleEliminationBracket';
import RoundRobinTable from './RoundRobinTable';
import { useBracketUpdates } from '../../hooks';

const BracketView = ({ tournament, onMatchClick, showSeeds = true }) => {
  const [localBracketData, setLocalBracketData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Use Socket.IO hook for real-time updates
  const { bracketData: realtimeBracketData, isConnected } = useBracketUpdates(
    tournament?.id,
    tournament?.bracketGenerated
  );

  // Initial fetch
  useEffect(() => {
    if (tournament?.bracketGenerated) {
      fetchBracket();
    } else {
      setLoading(false);
    }
  }, [tournament?.id, tournament?.bracketGenerated]);

  // Update local state when real-time data arrives
  useEffect(() => {
    if (realtimeBracketData) {
      setLocalBracketData(realtimeBracketData);
    }
  }, [realtimeBracketData]);

  const fetchBracket = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/tournaments/${tournament.id}/bracket`);
      const data = await response.json();

      if (data.success) {
        setLocalBracketData(data.data);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to load bracket');
      console.error('Error fetching bracket:', err);
    } finally {
      setLoading(false);
    }
  };

  const bracketData = localBracketData;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-green"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        <p>{error}</p>
      </div>
    );
  }

  if (!tournament?.bracketGenerated) {
    return (
      <div className="text-center py-8 text-muted">
        <p>Bracket will be generated when the tournament starts</p>
      </div>
    );
  }

  // Render appropriate bracket type
  switch (tournament.format) {
    case 'SINGLE_ELIMINATION':
      return (
        <SingleEliminationBracket
          bracketData={bracketData}
          onMatchClick={onMatchClick}
          showSeeds={showSeeds}
        />
      );

    case 'DOUBLE_ELIMINATION':
      return (
        <div className="text-center py-8 text-muted">
          <p>Double elimination bracket visualization coming soon</p>
        </div>
      );

    case 'ROUND_ROBIN':
      return (
        <RoundRobinTable
          bracketData={bracketData}
          onMatchClick={onMatchClick}
        />
      );

    default:
      return (
        <div className="text-center py-8 text-muted">
          <p>Unsupported bracket format</p>
        </div>
      );
  }
};

export default BracketView;
