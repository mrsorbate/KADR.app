import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { statsAPI } from '../lib/api';
import { ArrowLeft, TrendingUp, Calendar } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function StatsPage() {
  const { id } = useParams<{ id: string }>();
  const teamId = parseInt(id!);
  const { user } = useAuthStore();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['team-stats', teamId],
    queryFn: async () => {
      const response = await statsAPI.getTeamStats(teamId);
      return response.data;
    },
  });

  if (isLoading) {
    return <div className="text-center py-12">Lädt...</div>;
  }

  const getRate = (accepted: unknown, total: unknown): number => {
    const acceptedValue = Number(accepted || 0);
    const totalValue = Number(total || 0);
    if (totalValue <= 0) return 0;
    return Math.round((acceptedValue * 100) / totalValue);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center space-x-3 sm:space-x-4">
        <Link to={`/teams/${teamId}`} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-primary-600 shrink-0" />
          <span>Statistiken</span>
        </h1>
      </div>

      {/* Event Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 p-3 rounded-lg">
              <Calendar className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Vergangene Termine</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.events?.past || 0}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Training</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.events?.pastByCategory?.training || 0}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center space-x-3">
            <div className="bg-yellow-100 p-3 rounded-lg">
              <Calendar className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Spiele</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.events?.pastByCategory?.match || 0}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-100 p-3 rounded-lg">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Sonstiges</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.events?.pastByCategory?.other || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Statistics */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <TrendingUp className="w-6 h-6 mr-2 text-primary-600" />
          {user?.role === 'player' ? 'Meine Anwesenheitsstatistik' : 'Anwesenheitsstatistik'}
        </h2>
        <div className="space-y-3 md:hidden">
          {stats?.attendance?.map((player: any) => (
            <div key={player.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-900">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-gray-900 dark:text-white">{player.name}</p>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{player.attendance_rate || 0}%</span>
              </div>
              <progress
                className="w-full h-2 mb-2 [&::-webkit-progress-bar]:bg-gray-200 [&::-webkit-progress-bar]:dark:bg-gray-700 [&::-webkit-progress-value]:bg-green-600 [&::-moz-progress-bar]:bg-green-600 rounded-full overflow-hidden"
                max={100}
                value={player.attendance_rate || 0}
                title="Teilnahmequote"
                aria-label="Teilnahmequote"
              />
              <div className="grid grid-cols-3 gap-2 text-xs">
                <span className="text-green-700">✓ {player.accepted}</span>
                <span className="text-red-700">✗ {player.declined}</span>
                <span className="text-gray-700 dark:text-gray-300">⏳ {player.pending}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-700 dark:text-gray-300">
                <span>Gesamt: {player.accepted}/{player.total_events} ({getRate(player.accepted, player.total_events)}%)</span>
                <span>Training: {player.accepted_training}/{player.total_training} ({getRate(player.accepted_training, player.total_training)}%)</span>
                <span>Spiele: {player.accepted_match}/{player.total_match} ({getRate(player.accepted_match, player.total_match)}%)</span>
                <span>Sonstiges: {player.accepted_other}/{player.total_other} ({getRate(player.accepted_other, player.total_other)}%)</span>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Spieler
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Gesamt
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Training
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Spiele
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Sonstiges
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Zugesagt
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Abgesagt
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Keine Antwort
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {stats?.attendance?.map((player: any) => (
                <tr key={player.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{player.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <progress
                        className="w-24 h-2 mr-2 [&::-webkit-progress-bar]:bg-gray-200 [&::-webkit-progress-bar]:dark:bg-gray-700 [&::-webkit-progress-value]:bg-green-600 [&::-moz-progress-bar]:bg-green-600 rounded-full overflow-hidden"
                        max={100}
                        value={getRate(player.accepted, player.total_events)}
                        title="Teilnahmequote"
                        aria-label="Teilnahmequote"
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {player.accepted}/{player.total_events} ({getRate(player.accepted, player.total_events)}%)
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-medium">
                    {player.accepted_training}/{player.total_training} ({getRate(player.accepted_training, player.total_training)}%)
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-medium">
                    {player.accepted_match}/{player.total_match} ({getRate(player.accepted_match, player.total_match)}%)
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-medium">
                    {player.accepted_other}/{player.total_other} ({getRate(player.accepted_other, player.total_other)}%)
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-green-700 font-medium">{player.accepted}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-red-700 font-medium">{player.declined}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{player.pending}</span>
                  </td>
                </tr>
              ))}            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
