import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RequireAuth } from '../components/RequireAuth';
import { Landing } from '../routes/Landing';
import { Connect } from '../routes/Connect';
import { Onboard } from '../routes/Onboard';
import { Lobby } from '../routes/Lobby';
import { MatchRoom } from '../routes/MatchRoom';
import { Leaderboard } from '../routes/Leaderboard';
import { You } from '../routes/You';
import { Tournaments } from '../routes/Tournaments';
import { TournamentDetail } from '../routes/TournamentDetail';
import { TournamentCreate } from '../routes/TournamentCreate';
import { TournamentPayouts } from '../routes/TournamentPayouts';
import { MyTournaments } from '../routes/MyTournaments';

export const router = createBrowserRouter([
  // Public landing (root) + wallet sign-up flow.
  { path: '/', element: <Landing /> },
  { path: '/connect', element: <Connect /> },
  { path: '/onboard', element: <Onboard /> },
  // Authenticated platform — guarded by wallet + username. Home is /play.
  {
    element: <RequireAuth />,
    children: [
      { path: '/play', element: <Lobby /> },
      { path: '/match/:id', element: <MatchRoom /> },
      { path: '/tournaments', element: <Tournaments /> },
      { path: '/tournaments/create', element: <TournamentCreate /> },
      { path: '/tournaments/mine', element: <MyTournaments /> },
      { path: '/tournaments/:id', element: <TournamentDetail /> },
      { path: '/tournaments/:id/payouts', element: <TournamentPayouts /> },
      { path: '/board', element: <Leaderboard /> },
      { path: '/you', element: <You /> },
      { path: '*', element: <Navigate to="/play" replace /> },
    ],
  },
]);
