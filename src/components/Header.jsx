import { IoShieldOutline } from 'react-icons/io5';
import ThemeToggle from './ThemeToggle';
import './Header.css';

export default function Header() {
  return (
    <header className="header">
      <div className="header__container">
        <div className="header__logo">
          <IoShieldOutline className="header__icon" />
          <h1 className="header__title">SSRF Playground</h1>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}