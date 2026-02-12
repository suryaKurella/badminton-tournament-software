import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { clubAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button, Input, Textarea, LoadingSpinner } from '../../components/common';

const ClubEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    visibility: 'PUBLIC',
  });

  useEffect(() => {
    if (!authLoading) {
      fetchClub();
    }
  }, [id, authLoading]);

  const fetchClub = async () => {
    try {
      setLoading(true);
      const response = await clubAPI.getById(id);
      const club = response.data.data;

      // Check authorization
      const myMembership = club.myMembership;
      const isClubAdmin = myMembership && (myMembership.role === 'OWNER' || myMembership.role === 'ADMIN');

      if (!isClubAdmin && !isAdmin) {
        toast.error('You do not have permission to edit this club');
        navigate(`/clubs/${id}`);
        return;
      }

      setFormData({
        name: club.name,
        description: club.description || '',
        visibility: club.visibility,
      });
    } catch (error) {
      console.error('Error fetching club:', error);
      toast.error('Failed to load club');
      navigate('/clubs');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Club name is required');
      return;
    }

    try {
      setSaving(true);
      await clubAPI.update(id, formData);
      toast.success('Club updated successfully!');
      navigate(`/clubs/${id}`);
    } catch (error) {
      console.error('Error updating club:', error);
      toast.error(error.response?.data?.message || 'Failed to update club');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return <LoadingSpinner message="Loading club..." />;
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Link
        to={`/clubs/${id}`}
        className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
      >
        <ArrowLeft size={20} />
        Back to Club
      </Link>

      <div className="glass-card p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-6">
          Edit Club
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Club Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter club name"
            required
          />

          <Textarea
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Describe your club (optional)"
            rows={4}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Visibility
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="visibility"
                  value="PUBLIC"
                  checked={formData.visibility === 'PUBLIC'}
                  onChange={handleChange}
                  className="w-4 h-4 text-brand-blue"
                />
                <span className="text-gray-900 dark:text-white">Public</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  - Anyone can join
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="visibility"
                  value="PRIVATE"
                  checked={formData.visibility === 'PRIVATE'}
                  onChange={handleChange}
                  className="w-4 h-4 text-brand-blue"
                />
                <span className="text-gray-900 dark:text-white">Private</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  - Requires approval
                </span>
              </label>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="submit" variant="primary" loading={saving}>
              Save Changes
            </Button>
            <Link to={`/clubs/${id}`}>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClubEdit;
