import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tournamentAPI } from '../../services/api';
import { Input, Select, Textarea, Button } from '../../components/common';

const TournamentCreate = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    location: '',
    maxParticipants: '',
    tournamentType: 'SINGLES',
    format: 'SINGLE_ELIMINATION',
    status: 'DRAFT',
    numberOfGroups: '4',
    advancingPerGroup: '2',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await tournamentAPI.create(formData);
      navigate(`/tournaments/${response.data.data.id}`);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to create tournament');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-6 sm:mb-8 pb-4 border-b-2 border-gray-200 dark:border-slate-700">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">Create Tournament</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">Fill in the details to create a new tournament</p>
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
            label="Type"
            name="tournamentType"
            value={formData.tournamentType}
            onChange={handleChange}
            required
          >
            <option value="SINGLES">Singles</option>
            <option value="DOUBLES">Doubles</option>
            <option value="MIXED">Mixed Doubles</option>
          </Select>

          <Select
            label="Format"
            name="format"
            value={formData.format}
            onChange={handleChange}
            required
          >
            <option value="SINGLE_ELIMINATION">Single Elimination</option>
            <option value="DOUBLE_ELIMINATION">Double Elimination</option>
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
              >
                <option value="2">2 Groups (A, B)</option>
                <option value="4">4 Groups (A, B, C, D)</option>
                <option value="6">6 Groups</option>
                <option value="8">8 Groups</option>
              </Select>

              <Select
                label="Advancing Per Group"
                name="advancingPerGroup"
                value={formData.advancingPerGroup}
                onChange={handleChange}
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

        <div className="mb-8">
          <Select
            label="Initial Status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            required
          >
            <option value="DRAFT">Draft (Private - Only you can see it)</option>
            <option value="OPEN">Open (Public - Players can register)</option>
          </Select>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Choose "Draft" to set up the tournament privately, or "Open" to allow immediate registration.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <Button
            type="button"
            onClick={() => navigate('/tournaments')}
            variant="secondary"
            size="lg"
            className="sm:flex-1"
            fullWidth
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            loading={loading}
            size="lg"
            className="sm:flex-1"
            fullWidth
          >
            {loading ? 'Creating...' : 'Create Tournament'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default TournamentCreate;
