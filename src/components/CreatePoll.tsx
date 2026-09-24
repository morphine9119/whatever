import { useState } from 'react';

export default function CreatePoll() {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [createdPollId, setCreatedPollId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleOptionChange = (index: number, value: string) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
    if (error) setError(null);
  };

  const handleAddOption = () => {
    if (options.length >= 10) {
      setError('A poll can have at most 10 options.');
      return;
    }
    setOptions([...options, '']);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    const updated = options.filter((_, i) => i !== index);
    setOptions(updated);
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      setError('Please enter a question.');
      return;
    }

    const trimmedOptions = options.map((o) => o.trim());
    if (trimmedOptions.some((o) => !o)) {
      setError('Please fill in all options.');
      return;
    }

    if (trimmedOptions.length < 2) {
      setError('Please add at least two options.');
      return;
    }

    const lowerSet = new Set<string>();
    for (const opt of trimmedOptions) {
      if (lowerSet.has(opt.toLowerCase())) {
        setError('Duplicate options are not allowed.');
        return;
      }
      lowerSet.add(opt.toLowerCase());
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmedQuestion,
          options: trimmedOptions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create poll.');
        return;
      }

      setCreatedPollId(data.id);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const pollUrl = createdPollId
    ? `${window.location.origin}/poll/${createdPollId}`
    : '';

  const handleCopyLink = async () => {
    if (!pollUrl) return;
    try {
      await navigator.clipboard.writeText(pollUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = pollUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReset = () => {
    setCreatedPollId(null);
    setQuestion('');
    setOptions(['', '']);
    setError(null);
  };

  // Section 11: Poll sharing view
  if (createdPollId) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 mb-6">
          Poll created
        </h1>

        <p className="text-sm font-mono text-neutral-800 break-all select-all mb-6">
          {pollUrl}
        </p>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleCopyLink}
            className="bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-medium px-4 py-2 rounded transition-colors"
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>

          <a
            href={`/poll/${createdPollId}`}
            onClick={(e) => {
              e.preventDefault();
              window.history.pushState({}, '', `/poll/${createdPollId}`);
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            Go to poll →
          </a>

          <button
            type="button"
            onClick={handleReset}
            className="text-sm text-neutral-400 hover:text-neutral-700 ml-auto transition-colors"
          >
            Create another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 mb-8">
        Simple Poll
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="text"
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Question"
            maxLength={300}
            className="w-full px-3 py-2 text-sm bg-white border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none transition-colors placeholder:text-neutral-400"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          {options.map((opt, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={opt}
                onChange={(e) => handleOptionChange(index, e.target.value)}
                placeholder={`Option ${index + 1}`}
                maxLength={150}
                className="w-full px-3 py-2 text-sm bg-white border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none transition-colors placeholder:text-neutral-400"
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => handleRemoveOption(index)}
                  className="text-neutral-400 hover:text-neutral-700 text-sm px-1.5 py-1"
                  aria-label="Remove option"
                  title="Remove option"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        {options.length < 10 && (
          <div>
            <button
              type="button"
              onClick={handleAddOption}
              className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
            >
              + Add option
            </button>
          </div>
        )}

        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded transition-colors cursor-pointer"
          >
            {isSubmitting ? 'Creating...' : 'Create Poll'}
          </button>
        </div>
      </form>
    </div>
  );
}
