import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { getDb, saveDb } from '../database/db.ts';

const router = Router();

function generatePollId(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(6);
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[bytes[i] % chars.length];
  }
  return id;
}

interface OptionRow {
  id: number;
  text: string;
  votes: number;
}

interface PollResultOption extends OptionRow {
  percentage: number;
}

// Helper to fetch full poll details
async function getPollDetails(pollId: string) {
  const db = await getDb();

  const pollStmt = db.prepare('SELECT id, question, created_at FROM polls WHERE id = ?');
  pollStmt.bind([pollId]);
  
  if (!pollStmt.step()) {
    pollStmt.free();
    return null;
  }
  const poll = pollStmt.getAsObject() as { id: string; question: string; created_at: string };
  pollStmt.free();

  const optionsStmt = db.prepare('SELECT id, text, votes FROM options WHERE poll_id = ? ORDER BY id ASC');
  optionsStmt.bind([pollId]);
  const options: OptionRow[] = [];
  while (optionsStmt.step()) {
    const row = optionsStmt.getAsObject() as unknown as OptionRow;
    options.push({
      id: Number(row.id),
      text: String(row.text),
      votes: Number(row.votes) || 0,
    });
  }
  optionsStmt.free();

  const totalVotes = options.reduce((sum, opt) => sum + opt.votes, 0);

  const formattedOptions: PollResultOption[] = options.map((opt) => ({
    id: opt.id,
    text: opt.text,
    votes: opt.votes,
    percentage: totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0,
  }));

  return {
    id: poll.id,
    question: poll.question,
    created_at: poll.created_at,
    totalVotes,
    options: formattedOptions,
  };
}

// POST /api/polls
router.post('/polls', async (req: Request, res: Response) => {
  try {
    const { question, options } = req.body;

    if (!question || typeof question !== 'string' || !question.trim()) {
      res.status(400).json({ error: 'Please enter a question.' });
      return;
    }

    if (!Array.isArray(options)) {
      res.status(400).json({ error: 'Please provide a list of options.' });
      return;
    }

    const trimmedQuestion = question.trim();

    if (trimmedQuestion.length > 300) {
      res.status(400).json({ error: 'Question is too long (maximum 300 characters).' });
      return;
    }

    // Validate options
    const processedOptions: string[] = [];
    const lowerSet = new Set<string>();

    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      if (typeof opt !== 'string' || !opt.trim()) {
        res.status(400).json({ error: `Option ${i + 1} cannot be empty.` });
        return;
      }
      const trimmed = opt.trim();
      if (trimmed.length > 150) {
        res.status(400).json({ error: `Option "${trimmed.slice(0, 20)}..." is too long (maximum 150 characters).` });
        return;
      }

      if (lowerSet.has(trimmed.toLowerCase())) {
        res.status(400).json({ error: `Duplicate option found: "${trimmed}". All options must be unique.` });
        return;
      }
      lowerSet.add(trimmed.toLowerCase());
      processedOptions.push(trimmed);
    }

    if (processedOptions.length < 2) {
      res.status(400).json({ error: 'Please add at least two options.' });
      return;
    }

    if (processedOptions.length > 10) {
      res.status(400).json({ error: 'A poll can have at most 10 options.' });
      return;
    }

    const db = await getDb();

    // Generate unique ID
    let pollId = generatePollId();
    let attempts = 0;
    while (attempts < 10) {
      const checkStmt = db.prepare('SELECT id FROM polls WHERE id = ?');
      checkStmt.bind([pollId]);
      const exists = checkStmt.step();
      checkStmt.free();
      if (!exists) break;
      pollId = generatePollId();
      attempts++;
    }

    // Insert poll
    db.run('INSERT INTO polls (id, question) VALUES (?, ?)', [pollId, trimmedQuestion]);

    // Insert options
    for (const optText of processedOptions) {
      db.run('INSERT INTO options (poll_id, text, votes) VALUES (?, ?, 0)', [pollId, optText]);
    }

    saveDb(db);

    res.status(201).json({ id: pollId });
  } catch (err) {
    console.error('Error creating poll:', err);
    res.status(500).json({ error: 'Failed to create poll. Please try again.' });
  }
});

// GET /api/polls/:id
router.get('/polls/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      res.status(400).json({ error: 'Invalid poll ID.' });
      return;
    }

    const poll = await getPollDetails(id.trim());
    if (!poll) {
      res.status(404).json({ error: 'Poll not found.' });
      return;
    }

    res.json(poll);
  } catch (err) {
    console.error('Error fetching poll:', err);
    res.status(500).json({ error: 'Failed to fetch poll.' });
  }
});

// POST /api/polls/:id/vote
router.post('/polls/:id/vote', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { optionId } = req.body;

    if (!id || typeof id !== 'string') {
      res.status(400).json({ error: 'Invalid poll ID.' });
      return;
    }

    const numOptionId = Number(optionId);
    if (isNaN(numOptionId) || !Number.isInteger(numOptionId)) {
      res.status(400).json({ error: 'Invalid option.' });
      return;
    }

    const db = await getDb();

    // Check if poll exists
    const pollCheck = db.prepare('SELECT id FROM polls WHERE id = ?');
    pollCheck.bind([id.trim()]);
    const pollExists = pollCheck.step();
    pollCheck.free();

    if (!pollExists) {
      res.status(404).json({ error: 'Poll not found.' });
      return;
    }

    // Check if option belongs to this poll
    const optCheck = db.prepare('SELECT id FROM options WHERE id = ? AND poll_id = ?');
    optCheck.bind([numOptionId, id.trim()]);
    const optExists = optCheck.step();
    optCheck.free();

    if (!optExists) {
      res.status(400).json({ error: 'Invalid option.' });
      return;
    }

    // Increment votes
    db.run('UPDATE options SET votes = votes + 1 WHERE id = ? AND poll_id = ?', [numOptionId, id.trim()]);
    saveDb(db);

    // Fetch updated poll details
    const updatedPoll = await getPollDetails(id.trim());
    res.json(updatedPoll);
  } catch (err) {
    console.error('Error recording vote:', err);
    res.status(500).json({ error: 'Failed to record vote.' });
  }
});

export default router;
