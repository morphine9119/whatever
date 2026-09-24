import { useEffect, useState } from 'react';
import CreatePoll from './components/CreatePoll.tsx';
import PollView from './components/PollView.tsx';

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Match /poll/:id
  const pollMatch = currentPath.match(/^\/poll\/([^/]+)/);
  const pollId = pollMatch ? pollMatch[1] : null;

  return (
    <main className="min-h-screen bg-white text-neutral-900 flex flex-col items-center pt-16 sm:pt-24 pb-16 px-6">
      <div className="w-full max-w-md">
        {pollId ? (
          <PollView pollId={pollId} />
        ) : (
          <CreatePoll />
        )}
      </div>
    </main>
  );
}
