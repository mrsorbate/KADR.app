import db from '../database/init';
import { runTeamGameImport } from '../routes/teams';

let autoImportInterval: NodeJS.Timeout | null = null;
let autoImportRunning = false;

const parsePositiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

const runAutoImportCycle = async () => {
  if (autoImportRunning) {
    console.log('[Auto-Import] Skip cycle because previous cycle is still running');
    return;
  }

  autoImportRunning = true;
  try {
    const teams = db.prepare(`
      SELECT
        t.id as team_id,
        t.name as team_name,
        (
          SELECT tm.user_id
          FROM team_members tm
          WHERE tm.team_id = t.id AND tm.role = 'trainer'
          ORDER BY tm.user_id ASC
          LIMIT 1
        ) as trainer_user_id,
        (
          SELECT tm.user_id
          FROM team_members tm
          WHERE tm.team_id = t.id
          ORDER BY tm.user_id ASC
          LIMIT 1
        ) as fallback_user_id
      FROM teams t
      WHERE t.fussballde_id IS NOT NULL AND TRIM(t.fussballde_id) != ''
      ORDER BY t.id ASC
    `).all() as Array<{
      team_id: number;
      team_name: string;
      trainer_user_id: number | null;
      fallback_user_id: number | null;
    }>;

    if (teams.length === 0) {
      console.log('[Auto-Import] No configured teams found');
      return;
    }

    let importedTotal = 0;
    let updatedTotal = 0;
    let skippedTeams = 0;

    for (const team of teams) {
      const actorUserId = team.trainer_user_id ?? team.fallback_user_id;
      if (!actorUserId) {
        skippedTeams += 1;
        continue;
      }

      try {
        const result = await runTeamGameImport(team.team_id, actorUserId);
        importedTotal += Number(result.imported || 0);
        updatedTotal += Number(result.updated || 0);
      } catch (error) {
        skippedTeams += 1;
        console.error(`[Auto-Import] Team ${team.team_id} (${team.team_name}) failed:`, error);
      }
    }

    console.log(
      `[Auto-Import] Cycle done | teams=${teams.length} imported=${importedTotal} updated=${updatedTotal} skippedTeams=${skippedTeams}`
    );
  } finally {
    autoImportRunning = false;
  }
};

export const startAutoGameImportJob = () => {
  const enabled = String(process.env.AUTO_GAME_IMPORT_ENABLED || 'true').toLowerCase() !== 'false';
  if (!enabled) {
    console.log('[Auto-Import] Disabled by AUTO_GAME_IMPORT_ENABLED');
    return;
  }

  const intervalMinutes = parsePositiveInteger(process.env.AUTO_GAME_IMPORT_INTERVAL_MINUTES, 60);
  const runOnStartup = String(process.env.AUTO_GAME_IMPORT_RUN_ON_STARTUP || 'true').toLowerCase() !== 'false';

  if (runOnStartup) {
    void runAutoImportCycle();
  }

  autoImportInterval = setInterval(() => {
    void runAutoImportCycle();
  }, intervalMinutes * 60 * 1000);

  console.log(`[Auto-Import] Started | every ${intervalMinutes} minute(s), season window 01.07-30.06`);
};

export const stopAutoGameImportJob = () => {
  if (autoImportInterval) {
    clearInterval(autoImportInterval);
    autoImportInterval = null;
  }
};
