import { INITIAL_BALANCE, INITIAL_TOTAL_WIN } from '../config/currency';
import { STRINGS } from '../config/strings';
import { GameRoundMachine } from '../state/GameRoundMachine';
import { SpinResponse, SpinService } from '../services/SpinService';
import { fetchRemoteProfile, RemoteProfile } from '../services/supabaseClient';
import { IGameUI } from '../ui/IGameUI';

export interface WalletControllerDeps {
  roundMachine: GameRoundMachine;
  spinService: SpinService;
  getUI: () => IGameUI | null;
  fetchProfile?: () => Promise<RemoteProfile>;
}

/** The client copy of the wallet. In Supabase mode the server is the source of truth. */
export class WalletController {
  private _balance = INITIAL_BALANCE;
  private _totalWin = INITIAL_TOTAL_WIN;

  constructor(private readonly deps: WalletControllerDeps) {
    deps.roundMachine.setBalance(this._balance);
    deps.roundMachine.setTotalWin(this._totalWin);

    deps.roundMachine.on('balance:changed', ({ balance, reason }) => {
      this._balance = balance;
      this.deps.getUI()?.setBalance(balance, true);
      if (reason === 'win') {
        this._totalWin = this.deps.roundMachine.context.totalWin;
        this.deps.getUI()?.setTotalWin(this._totalWin, true);
      }
    });
  }

  get balance(): number {
    return this._balance;
  }

  get totalWin(): number {
    return this._totalWin;
  }

  apply(balance: number, totalWin: number, animate = false): void {
    this._balance = balance;
    this._totalWin = totalWin;
    this.deps.roundMachine.setBalance(balance);
    this.deps.roundMachine.setTotalWin(totalWin);
    this.deps.getUI()?.setBalance(balance, animate);
    this.deps.getUI()?.setTotalWin(totalWin, animate);
  }

  resetMock(): void {
    this.apply(INITIAL_BALANCE, INITIAL_TOTAL_WIN);
  }

  /** Shows the round win in TOTAL WIN while the win plays. The balance updates on settle. */
  showRoundWin(response: SpinResponse): void {
    this._totalWin = response.totalWin ?? this._totalWin + response.winAmount;
    this.deps.getUI()?.setTotalWin(this._totalWin, true);
  }

  /** Reads the wallet back from the server after a round whose outcome the client could not confirm. */
  async syncFromServer(): Promise<void> {
    const { roundMachine, spinService } = this.deps;
    await spinService.whenIdle();

    try {
      const profile = await (this.deps.fetchProfile ?? fetchRemoteProfile)();
      // A newer round carries its own server balance, so a late sync must not overwrite it.
      const roundIsOver = roundMachine.matches('idle') || roundMachine.matches('error');
      if (spinService.getSource() !== 'supabase' || !roundIsOver) {
        return;
      }
      this.apply(profile.balance, profile.totalWin, true);
    } catch (error) {
      console.error('Balance sync failed', error);
      this.deps.getUI()?.showError(STRINGS.supabase.balanceSyncFailed);
    }
  }
}
