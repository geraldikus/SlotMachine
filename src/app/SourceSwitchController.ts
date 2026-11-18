import { STRINGS } from '../config/strings';
import { GameRoundMachine } from '../state/GameRoundMachine';
import { SpinService, SpinSourceSwitch } from '../services/SpinService';
import { connectSupabaseProfile } from '../services/supabaseClient';
import { IGameUI } from '../ui/IGameUI';
import { PracticePanel } from '../ui/debug/PracticePanel';
import { WalletController } from './WalletController';

export interface SourceSwitchDeps {
  spinService: SpinService;
  roundMachine: GameRoundMachine;
  wallet: WalletController;
  isReplayActive: () => boolean;
  getUI: () => IGameUI | null;
  getPracticePanel: () => PracticePanel | null;
}

/** Switches spins between the local mock and the Supabase server and loads the matching wallet. */
export class SourceSwitchController implements SpinSourceSwitch {
  private inFlight = false;

  constructor(private readonly deps: SourceSwitchDeps) {}

  canSwitch = (): boolean =>
    this.deps.roundMachine.matches('idle') && !this.inFlight && !this.deps.isReplayActive();

  onToggle = (): void => {
    void this.toggle();
  };

  /** Pushes the current source into the demo panels. */
  syncUI(): void {
    this.deps.getPracticePanel()?.syncFromService();
    this.deps.getUI()?.syncDemoPanel();
  }

  private async toggle(): Promise<void> {
    if (!this.canSwitch()) {
      return;
    }

    const { spinService, wallet } = this.deps;
    this.inFlight = true;
    const nextSource = spinService.getSource() === 'mock' ? 'supabase' : 'mock';

    try {
      if (nextSource === 'supabase') {
        const profile = await connectSupabaseProfile();
        spinService.setSource('supabase');
        wallet.apply(profile.balance, profile.totalWin);
      } else {
        spinService.setSource('mock');
        wallet.resetMock();
      }
      this.deps.getPracticePanel()?.clearArmedVisuals();
      this.deps.getUI()?.clearDemoPanelArmedVisuals();
    } catch (error) {
      spinService.setSource('mock');
      console.error('Supabase connection failed', error);
      const notConfigured = error instanceof Error && error.message === STRINGS.supabase.notConfigured;
      const message = notConfigured ? STRINGS.supabase.notConfigured : STRINGS.supabase.connectFailed;
      this.deps.getUI()?.showError(message);
    } finally {
      this.inFlight = false;
      this.syncUI();
    }
  }
}
