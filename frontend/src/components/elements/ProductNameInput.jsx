import { useRef } from 'react';
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
  
  const allSuggestions = getSuggestions();
  console.log("Suggestions Count:", allSuggestions.length);
console.log("Suggestions:", allSuggestions.slice(0, 5));
  const datalistId = useRef(id ? `suggestions-${id}` : `suggestions-${Math.random().toString(36).substring(2, 9)}`).current;

  const handleChange = (e) => {
    onChange(e.target.value);
  };

  const handleBlur = () => {
    recordUsedName(value);
  };

  return (
    <div style={{ width: '100%' }}>
      <input
        className={className}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        style={style}
        id={id}
        autoFocus={autoFocus}
        autoComplete="off"
        list={datalistId}
      />
      <datalist id={datalistId}>
        {allSuggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </div>
  );
}
