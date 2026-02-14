import { useState, useEffect, useRef } from 'react';
import { Search, X, User, Check } from 'lucide-react';
import { tournamentAPI } from '../../services/api';

const PartnerSelect = ({ tournamentId, value, onChange, disabled = false }) => {
  const [search, setSearch] = useState('');
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Fetch partners when search changes
  useEffect(() => {
    const fetchPartners = async () => {
      if (!tournamentId) return;

      setLoading(true);
      try {
        const response = await tournamentAPI.getPotentialPartners(tournamentId, search);
        setPartners(response.data.data || []);
      } catch (error) {
        console.error('Error fetching partners:', error);
        setPartners([]);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchPartners, 300);
    return () => clearTimeout(debounce);
  }, [tournamentId, search]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update selected partner when value changes externally
  useEffect(() => {
    if (!value) {
      setSelectedPartner(null);
    }
  }, [value]);

  const handleSelect = (partner) => {
    setSelectedPartner(partner);
    onChange(partner.id);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = () => {
    setSelectedPartner(null);
    onChange(null);
    setSearch('');
  };

  const getDisplayName = (partner) => {
    return partner.fullName || partner.username || 'Unknown';
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <label className="block mb-2 font-semibold text-gray-900 dark:text-white text-sm">
        Select Partner <span className="text-gray-500 font-normal">(Optional)</span>
      </label>

      {selectedPartner ? (
        // Show selected partner
        <div className="flex items-center justify-between px-4 py-3 border-2 border-brand-green rounded-md bg-green-50 dark:bg-green-900/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-green/20 flex items-center justify-center">
              <User size={16} className="text-brand-green" />
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                {getDisplayName(selectedPartner)}
              </p>
              {selectedPartner.isRegistered && (
                <p className="text-xs text-brand-green">Already registered</p>
              )}
            </div>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <X size={18} className="text-gray-500" />
            </button>
          )}
        </div>
      ) : (
        // Show search input
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setIsOpen(true)}
            placeholder="Search for a partner by name..."
            disabled={disabled}
            className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:border-blue-600 dark:focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
      )}

      {/* Dropdown */}
      {isOpen && !selectedPartner && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {loading ? (
            <div className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">
              Searching...
            </div>
          ) : partners.length === 0 ? (
            <div className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">
              {search ? 'No users found' : 'Type to search for partners'}
            </div>
          ) : (
            partners.map((partner) => (
              <button
                key={partner.id}
                type="button"
                onClick={() => handleSelect(partner)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-600 flex items-center justify-center overflow-hidden">
                  {partner.avatarUrl ? (
                    <img src={partner.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User size={16} className="text-gray-500 dark:text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {getDisplayName(partner)}
                  </p>
                  {partner.username && partner.fullName && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">@{partner.username}</p>
                  )}
                </div>
                {partner.isRegistered && (
                  <span className="flex items-center gap-1 text-xs text-brand-green bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">
                    <Check size={12} />
                    Registered
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}

      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        You can register without a partner and be paired randomly, or select a registered player to team up.
      </p>
    </div>
  );
};

export default PartnerSelect;
