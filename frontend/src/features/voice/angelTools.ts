import { supabase } from '../../lib/supabase';

export const ANGEL_INSTRUCTIONS = `
You are Angel, the live voice guide for FanField (fanfield.xyz). You are friendly,
quick, and you sound like a football fan. Keep answers short and spoken-word
natural, one to three sentences unless the user asks for more.

What FanField is: a free, live play-along football game for the World Cup. Fans
predict the next moments of a real match and every result is settled from the
TxLINE live data feed by TxODDS, with receipts anchored on Solana, so results are
provably fair. It is not betting: players use coins and points, not cash.

Features you know:
- Flash Pools: quick yes/no calls during a live match (next goal, card or corner
  in a 5 minute window). Minimum stake is 100 coins. Wins grow a streak, and a
  longer streak raises the payout multiplier. A wrong call resets the streak.
- Call the Score and Fan War: before kickoff fans predict the final score and back
  a side. Exact score pays 250 coins, right result pays 75. The Fan War bar shows
  which team has more backers.
- Score Link: pick the exact final scoreline for a match before kickoff and stake
  coins on it. Harder scorelines pay bigger multipliers. One pick per match,
  locked once staked. A real-money version is coming soon.
- Squads: private rooms where friends play the same match on one leaderboard.
- Tournaments (battles): free entry, everyone starts with 1,000 points, hosts fund
  real USDC prizes and pay winners directly, verified on Solana.
- Replay: finished matches can be rewatched with an animated timeline.
- Chat: a public room per match plus private squad chat.
- Notifications: in-app inbox, browser push, and a Telegram bot (@fanfieldbot)
  with goals, cards, corners, kickoff, results and pre-match reminders.
- Coins refill daily; a paid top-up (1,000 coins for 3 dollars) is coming soon.

When a user asks about live numbers (score, goals, corners, cards, minute, who is
playing, leaderboard, their own coins or streak), always call the matching tool
and answer from its result. Never invent stats. If a tool returns nothing, say the
match or data is not available right now. Say team names naturally, not codes.
`.trim();

export const ANGEL_TOOLS = [
  {
    type: 'function',
    name: 'get_live_matches',
    description: 'List current live and upcoming World Cup matches with scores, minute and stage.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    type: 'function',
    name: 'get_match_stats',
    description: 'Live stats for the match a team is playing: score, minute, phase, goals, corners, yellow and red cards.',
    parameters: {
      type: 'object',
      properties: { team: { type: 'string', description: 'Team name or 3-letter code, e.g. Belgium or BEL' } },
      required: ['team'],
    },
  },
  {
    type: 'function',
    name: 'get_leaderboard',
    description: 'Top players on the global FanField leaderboard.',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'How many players, default 5' } },
      required: [],
    },
  },
  {
    type: 'function',
    name: 'get_my_stats',
    description: "The current user's own coins, streak and recent results.",
    parameters: { type: 'object', properties: {}, required: [] },
  },
];

type Row = Record<string, unknown>;

async function matchByTeam(team: string): Promise<Row | null> {
  const t = team.trim();
  const { data } = await supabase
    .from('matches')
    .select('*')
    .or(`home_code.ilike.%${t}%,away_code.ilike.%${t}%,home_name.ilike.%${t}%,away_name.ilike.%${t}%`)
    .in('status', ['live', 'upcoming', 'finished'])
    .order('kickoff', { ascending: false })
    .limit(5);
  if (!data?.length) return null;
  return data.find((m) => m.status === 'live') ?? data.find((m) => m.status === 'upcoming') ?? data[0];
}

export async function runAngelTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    if (name === 'get_live_matches') {
      const { data } = await supabase
        .from('matches')
        .select('home_name, away_name, home_score, away_score, status, phase, minute, stage, kickoff')
        .in('status', ['live', 'upcoming'])
        .order('kickoff', { ascending: true })
        .limit(10);
      return { matches: data ?? [] };
    }

    if (name === 'get_match_stats') {
      const m = await matchByTeam(String(args.team ?? ''));
      if (!m) return { found: false };
      const { data: corners } = await supabase
        .from('match_events')
        .select('side')
        .eq('match_id', m.id)
        .eq('kind', 'corner');
      const home = (corners ?? []).filter((c) => c.side === 'home').length;
      const away = (corners ?? []).filter((c) => c.side === 'away').length;
      return {
        found: true,
        homeTeam: m.home_name, awayTeam: m.away_name,
        score: `${m.home_score}-${m.away_score}`,
        status: m.status, phase: m.phase, minute: m.minute, stage: m.stage,
        goals: { home: m.home_score, away: m.away_score },
        corners: { home, away },
        yellowCards: { home: m.home_yellow ?? 0, away: m.away_yellow ?? 0 },
        redCards: { home: m.home_red ?? 0, away: m.away_red ?? 0 },
      };
    }

    if (name === 'get_leaderboard') {
      const limit = Math.min(Number(args.limit ?? 5) || 5, 10);
      const { data } = await supabase
        .from('profiles')
        .select('username, coins, streak')
        .not('username', 'is', null)
        .order('coins', { ascending: false })
        .limit(limit);
      return { players: data ?? [] };
    }

    if (name === 'get_my_stats') {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return { signedIn: false };
      const { data: prof } = await supabase
        .from('profiles')
        .select('username, coins, streak')
        .eq('id', auth.user.id)
        .maybeSingle();
      const { data: recent } = await supabase
        .from('settlements')
        .select('result')
        .eq('user_id', auth.user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      const wins = (recent ?? []).filter((r) => r.result === 'win').length;
      return { signedIn: true, ...prof, recentCalls: recent?.length ?? 0, recentWins: wins };
    }

    return { error: 'unknown tool' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'tool failed' };
  }
}
