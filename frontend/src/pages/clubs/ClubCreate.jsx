import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { clubAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Button, Input, Textarea } from '../../components/common';

const ClubCreate = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    visibility: 'PUBLIC',
  });

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
      setLoading(true);
      const response = await clubAPI.create(formData);
      toast.success('Club created successfully!');
      navigate(`/clubs/${response.data.data.id}`);
    } catch (error) {
      console.error('Error creating club:', error);
      toast.error(error.response?.data?.message || 'Failed to create club');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Link
        to="/clubs"
        className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
      >
        <ArrowLeft size={20} />
        Back to Clubs
      </Link>

      <div className="glass-card p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-6">
          Create New Club
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
            <Button type="submit" variant="primary" loading={loading}>
              Create Club
            </Button>
            <Link to="/clubs">
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

export default ClubCreate;
