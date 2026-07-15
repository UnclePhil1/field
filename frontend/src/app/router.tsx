import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RequireAuth } from '../components/RequireAuth';
import { Landing } from '../routes/Landing';
import { Connect } from '../routes/Connect';
import { Lobby } from '../routes/Lobby';
import { Live } from '../routes/Live';
import { MatchRoom } from '../routes/MatchRoom';
import { SquadJoin } from '../routes/Squad';
import { Brag } from '../routes/Brag';
import { Score } from '../routes/Score';
import { AngelPage } from '../routes/Angel';
import { Replay } from '../routes/Replay';
import { ReplayMatch } from '../routes/Replay/Match';
import { Leaderboard } from '../routes/Leaderboard';
import { You } from '../routes/You';
import { Tournaments } from '../routes/Tournaments';
import { TournamentDetail } from '../routes/TournamentDetail';
import { TournamentCreate } from '../routes/TournamentCreate';
import { TournamentPayouts } from '../routes/TournamentPayouts';
import { MyTournaments } from '../routes/MyTournaments';

// agent.fanfield.xyz opens straight into Angel.
const isAgentHost = typeof window !== 'undefined' && window.location.hostname.startsWith('agent.');

export const router = createBrowserRouter([
  { path: '/', element: isAgentHost ? <Navigate to="/angel" replace /> : <Landing /> },
  { path: '/connect', element: <Connect /> },
  { path: '/squad/:code', element: <SquadJoin /> },
  { path: '/brag', element: <Brag /> },
  { path: '/score', element: <Score /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/play', element: <Lobby /> },
      { path: '/live', element: <Live /> },
      { path: '/angel', element: <AngelPage /> },
      { path: '/match/:id', element: <MatchRoom /> },
      { path: '/replay', element: <Replay /> },
      { path: '/replay/:id', element: <ReplayMatch /> },
      { path: '/tournaments', element: <Tournaments /> },
      { path: '/tournaments/create', element: <TournamentCreate /> },
      { path: '/tournaments/mine', element: <MyTournaments /> },
      { path: '/tournaments/:id', element: <TournamentDetail /> },
      { path: '/tournaments/:id/edit', element: <TournamentCreate /> },
      { path: '/tournaments/:id/payouts', element: <TournamentPayouts /> },
      { path: '/board', element: <Leaderboard /> },
      { path: '/you', element: <You /> },
      { path: '*', element: <Navigate to="/play" replace /> },
    ],
  },
]);
