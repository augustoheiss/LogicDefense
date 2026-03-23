import { useState } from 'react';
import { MainMenu } from '../games/LogicAscension/MainMenu';
import { LogicAscension } from '../games/LogicAscension/LogicAscension';

type AppView = 'menu' | 'playing';

export function LogicAscensionPage() {
  const [appView, setAppView] = useState<AppView>('menu');

  if (appView === 'menu') {
    return <MainMenu onPlay={() => setAppView('playing')} />;
  }

  return (
    <LogicAscension
      onGoToMenu={() => setAppView('menu')}
    />
  );
}
