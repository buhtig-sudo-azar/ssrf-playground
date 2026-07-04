import { IoSunny, IoMoon } from 'react-icons/io5';
import { useTheme } from '../contexts/ThemeContext';
import './ThemeToggle.css';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={theme === 'light' ? 'Переключить на тёмную тему' : 'Переключить на светлую тему'}
      title={theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}
    >
      <span className="theme-toggle__icon">
        {theme === 'light' ? <IoMoon size={20} /> : <IoSunny size={20} />}
      </span>
    </button>
  );
}