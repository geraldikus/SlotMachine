import { RoundRecord } from '../round/types';

const MAX_ROUNDS = 20;

export class InMemoryRoundHistory {
  private readonly rounds: RoundRecord[] = [];

  record(round: RoundRecord): void {
    this.rounds.unshift(round);
    if (this.rounds.length > MAX_ROUNDS) {
      this.rounds.length = MAX_ROUNDS;
    }
  }

  listRecent(limit = MAX_ROUNDS): RoundRecord[] {
    return this.rounds.slice(0, limit);
  }

  get(id: string): RoundRecord | undefined {
    return this.rounds.find((round) => round.id === id);
  }
}
