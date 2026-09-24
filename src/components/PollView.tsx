import { useEffect, useState } from 'react';
import type { PollData } from '../types.ts';

interface PollViewProps {
  pollId: string;
}

export default function PollView({ pollId }: PollViewProps) {
  const [poll, setPoll] = useState<PollData | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [userVotedOptionId, setUserVotedOptionId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Check localStorage for previous vote on this poll
  useEffect(() => {
    const savedVote = localStorage.getItem(`simple_poll_voted_${pollId}`);
    if (savedVote) {
      setHasVoted(true);
      setUserVotedOptionId(Number(savedVote));
    }
  }, [pollId]);

  // Fetch poll data
  useEffect(() => {
    let isCancelled = false;

    async function fetchPoll() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/polls/${encodeURIComponent(pollId)}`);
        const data = await res.json();
        if (isCancelled) return;

        if (!res.ok) {
          setError(data.error || 'Poll not found.');
          setPoll(null);
          return;
        }

        setPoll(data);
      } catch {
        if (!isCancelled) {
          setError('Failed to load poll. Please try again.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchPoll();

    return () => {
      isCancelled = true;
    };
  }, [pollId]);

  const handleVote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedOption === null) {
      setError('Please select an option.');
      return;
    }

    setIsVoting(true);
    setError(null);

    try {
      const res = await fetch(`/api/polls/${encodeURIComponent(pollId)}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId: selectedOption }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to submit vote.');
        return;
      }

      // Record in localStorage
      localStorage.setItem(`simple_poll_voted_${pollId}`, String(selectedOption));
      setUserVotedOptionId(selectedOption);
      setHasVoted(true);
      setPoll(data);
    } catch {
      setError('Network error. Failed to record vote.');
    } finally {
      setIsVoting(false);
    }
  };

  const handleCopyLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="py-8">
        <p className="text-sm text-neutral-400">Loading poll...</p>
      </div>
    );
  }

  if (error && !poll) {
    return (
      <div>
        <p className="text-sm text-neutral-800 mb-6">{error}</p>
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            window.history.pushState({}, '', '/');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
          className="text-sm text-neutral-900 underline underline-offset-4"
        >
          Create a poll
        </a>
      </div>
    );
  }

  if (!poll) {
    return null;
  }

  return (
    <div>
      <div className="mb-8">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            window.history.pushState({}, '', '/');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
          className="text-xs tracking-wider uppercase text-neutral-400 hover:text-neutral-700 transition-colors inline-block mb-3"
        >
          Simple Poll
        </a>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          {poll.question}
        </h1>
      </div>

      {!hasVoted ? (
        /* Voting Form */
        <form onSubmit={handleVote} className="space-y-6">
          <div className="space-y-3">
            {poll.options.map((option) => (
              <label
                key={option.id}
                className="flex items-center gap-3 cursor-pointer group py-1"
              >
                <input
                  type="radio"
                  name="poll-option"
                  value={option.id}
                  checked={selectedOption === option.id}
                  onChange={() => {
                    setSelectedOption(option.id);
                    if (error) setError(null);
                  }}
                  className="w-4 h-4 text-neutral-900 border-neutral-300 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-sm text-neutral-800 group-hover:text-neutral-950 transition-colors select-none">
                  {option.text}
                </span>
              </label>
            ))}
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="pt-2 flex items-center gap-4">
            <button
              type="submit"
              disabled={isVoting || selectedOption === null}
              className="bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded transition-colors cursor-pointer"
            >
              {isVoting ? 'Voting...' : 'Vote'}
            </button>

            <button
              type="button"
              onClick={() => setHasVoted(true)}
              className="text-sm text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
            >
              View results
            </button>
          </div>
        </form>
      ) : (
        /* Results View */
        <div className="space-y-6">
          <div className="space-y-4">
            {poll.options.map((option) => {
              const isUserVote = userVotedOptionId === option.id;
              return (
                <div key={option.id} className="space-y-1">
                  <div className="flex justify-between items-baseline text-sm">
                    <span className="text-neutral-900 font-medium">
                      {option.text}
                      {isUserVote && (
                        <span className="ml-2 text-xs font-normal text-neutral-500">
                          (Your vote)
                        </span>
                      )}
                    </span>
                    <span className="text-neutral-600 text-sm tabular-nums">
                      {option.votes} {option.votes === 1 ? 'vote' : 'votes'}{' '}
                      <span className="text-neutral-400 font-mono text-xs">
                        ({option.percentage}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neutral-900 rounded-full transition-all duration-300"
                      style={{ width: `${option.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
            <span>
              {poll.totalVotes} {poll.totalVotes === 1 ? 'total vote' : 'total votes'}
            </span>

            <button
              type="button"
              onClick={handleCopyLink}
              className="text-neutral-600 hover:text-neutral-900 font-medium transition-colors cursor-pointer"
            >
              {copied ? 'Copied link' : 'Copy link'}
            </button>
          </div>

          <div className="pt-2">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState({}, '', '/');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="text-xs text-neutral-500 hover:text-neutral-900 underline underline-offset-4"
            >
              + Create another poll
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
