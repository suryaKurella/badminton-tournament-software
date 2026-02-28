import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, X } from 'lucide-react';

const SearchableSelect = ({
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  disabledValues = [],
  className = ''
}) => {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const selectedOption = options.find(o => o.value === value);

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 260),
      });
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        wrapperRef.current && !wrapperRef.current.contains(event.target) &&
        dropdownRef.current && !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update position on scroll/resize while open
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, updatePosition]);

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (option) => {
    onChange(option.value);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearch('');
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {/* Trigger / display */}
      <div
        ref={triggerRef}
        onClick={() => {
          if (!isOpen) {
            updatePosition();
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          } else {
            setIsOpen(false);
            setSearch('');
          }
        }}
        className="w-full px-3 py-2 glass-surface rounded-lg text-light-text-primary dark:text-white focus-within:ring-2 focus-within:ring-brand-blue/25 cursor-pointer flex items-center justify-between gap-2"
      >
        {selectedOption ? (
          <>
            <span className="truncate">{selectedOption.label}</span>
            <button
              type="button"
              onClick={handleClear}
              className="shrink-0 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
            >
              <X size={14} className="text-gray-400" />
            </button>
          </>
        ) : (
          <>
            <span className="text-gray-400 truncate">{placeholder}</span>
            <ChevronDown size={16} className="shrink-0 text-gray-400" />
          </>
        )}
      </div>

      {/* Dropdown via portal */}
      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            zIndex: 9999,
          }}
          className="bg-white dark:bg-slate-800 border border-light-border dark:border-slate-600 rounded-lg shadow-xl overflow-hidden"
        >
          {/* Search input */}
          <div className="p-2 border-b border-light-border dark:border-slate-600">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-light-surface dark:bg-slate-700 rounded-md text-light-text-primary dark:text-white focus:outline-none placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400 text-center">
                No results found
              </div>
            ) : (
              filtered.map((option) => {
                const isDisabled = disabledValues.includes(option.value);
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleSelect(option)}
                    className={`w-full px-3 py-2 text-sm text-left transition-colors ${
                      isSelected
                        ? 'bg-brand-blue/10 text-brand-blue dark:text-blue-300 font-medium'
                        : isDisabled
                          ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                          : 'text-light-text-primary dark:text-white hover:bg-light-surface dark:hover:bg-slate-700'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SearchableSelect;
