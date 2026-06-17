import { useState, useRef, useEffect } from 'react';
import { getSuggestions, recordUsedName } from '../../utils/productSuggestions';

export default function ProductNameInput({
  value = '',
  onChange,
  placeholder = 'Product name',
  style,
  id,
  autoFocus,
  className = 'form-input',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const allSuggestions = getSuggestions();
  const wrapperRef = useRef(null);
  const dropdownRef = useRef(null);

  // Filter suggestions case-insensitively
  const suggestions = allSuggestions.filter(name =>
    name.toLowerCase().includes(value.toLowerCase())
  );

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e) => {
    onChange(e.target.value);
    setIsOpen(true);
    setHighlightedIndex(0);
  };

  const handleFocus = () => {
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const selectSuggestion = (name) => {
    onChange(name);
    setIsOpen(false);
    recordUsedName(name);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1 < suggestions.length ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        selectSuggestion(suggestions[highlightedIndex]);
      } else {
        setIsOpen(false);
      }
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  // Keep highlighted item in view when using arrow keys
  useEffect(() => {
    if (highlightedIndex >= 0 && dropdownRef.current) {
      const activeEl = dropdownRef.current.children[highlightedIndex];
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  return (
    <div 
      ref={wrapperRef} 
      style={{ 
        position: 'relative', 
        width: '100%',
        zIndex: isOpen ? 1000 : 1
      }}
    >
      <input
        className={className}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={() => {
          // Record after a slight delay to allow item mousedown events to register first
          setTimeout(() => {
            if (value.trim()) {
              recordUsedName(value);
            }
          }, 200);
        }}
        onKeyDown={handleKeyDown}
        style={style}
        id={id}
        autoFocus={autoFocus}
        autoComplete="off"
      />
      {isOpen && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="search-ac__dropdown"
          onMouseDown={(e) => {
            // Prevent input blur when clicking the container/scrollbar
            e.preventDefault();
          }}
          style={{
            zIndex: 99999,
            top: '100%',
            bottom: 'auto',
            marginTop: '4px',
          }}
        >
          {suggestions.map((name, idx) => (
            <div
              key={name}
              className={`search-ac__item ${idx === highlightedIndex ? 'active' : ''}`}
              onMouseEnter={() => setHighlightedIndex(idx)}
              onMouseDown={(e) => {
                e.preventDefault();
                selectSuggestion(name);
              }}
              style={{
                background: idx === highlightedIndex ? 'var(--color-primary-muted)' : undefined,
                cursor: 'pointer',
              }}
            >
              {name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
