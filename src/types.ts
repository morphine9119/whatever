export interface PollOption {
  id: number;
  text: string;
  votes: number;
  percentage: number;
}

export interface PollData {
  id: string;
  question: string;
  created_at: string;
  totalVotes: number;
  options: PollOption[];
}
