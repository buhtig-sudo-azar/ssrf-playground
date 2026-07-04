import { IoArrowUp } from 'react-icons/io5';
import { useScrollPosition } from '../hooks/useScrollPosition';
import './ScrollToTopButton.css';

export default function ScrollToTopButton() {
  const scrollY = useScrollPosition();
  const isVisible = scrollY > 300;

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      className={`scroll-top-btn ${isVisible ? 'scroll-top-btn--visible' : ''}`}
      onClick={scrollToTop}
      aria-label="Прокрутить наверх"
      title="Наверх"
    >
      <IoArrowUp size={22} />
    </button>
  );
}