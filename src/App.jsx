import Header from './components/Header';
import Footer from './components/Footer';
import TheorySection from './components/TheorySection';
import Sandbox from './components/Sandbox';
import ScrollToTopButton from './components/ScrollToTopButton';
import './App.css';

function App() {
  return (
    <div className="app">
      <Header />
      <main className="app__main">
        <TheorySection />
        <Sandbox />
      </main>
      <Footer />
      <ScrollToTopButton />
    </div>
  );
}

export default App;