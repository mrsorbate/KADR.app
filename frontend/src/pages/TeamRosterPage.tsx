import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { teamsAPI } from '../lib/api';
import { ArrowLeft, Users, X } from 'lucide-react';
import { resolveAssetUrl } from '../lib/utils';
import PlayerInviteManager from '../components/PlayerInviteManager';
import { useState } from 'react';
import { useAuthStore } from '../store/authStore';

export default function TeamRosterPage() {
  const { id } = useParams<{ id: string }>();
  const teamId = parseInt(id!);
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const { user } = useAuthStore();

  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ['team', teamId],
    queryFn: async () => {
      const response = await teamsAPI.getById(teamId);
      return response.data;
    },
  });

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['team-members', teamId],
    queryFn: async () => {
      const response = await teamsAPI.getMembers(teamId);
      return response.data;
    },
  });

  const trainers = members?.filter((m: any) => m.role === 'trainer') || [];
  const players = members?.filter((m: any) => m.role === 'player') || [];

  if (teamLoading || membersLoading) {
    return <div className="text-center py-12">Lädt...</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-start sm:items-center gap-3 sm:gap-4">
        <Link
          to={`/teams/${teamId}`}
          className="mt-1 sm:mt-0 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white break-words">
            Trainer &amp; Spieler - {team?.name}
          </h1>
        </div>
      </div>

      <div className="space-y-6">
        <div className="card">
          <h2 className="text-xl font-semibold mb-4 flex items-center text-gray-900 dark:text-white">
            <span className="mr-2">👨‍🏫</span>
            Trainer
            <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200">
              {trainers.length}
            </span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {trainers.map((trainer: any) => (
              <button
                key={trainer.id}
                onClick={() => setSelectedMember(trainer)}
                className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer text-left"
              >
                {resolveAssetUrl(trainer.profile_picture) ? (
                  <img
                    src={resolveAssetUrl(trainer.profile_picture)}
                    alt={trainer.name}
                    className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                  />
                ) : (
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-600 font-semibold">
                      {trainer.name.charAt(0)}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{trainer.name}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold mb-4 flex items-center text-gray-900 dark:text-white">
            <span className="mr-2">⚽</span>
            Spieler
            <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200">
              {players.length}
            </span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {players.map((player: any) => (
              <button
                key={player.id}
                onClick={() => setSelectedMember(player)}
                className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer text-left"
              >
                {resolveAssetUrl(player.profile_picture) ? (
                  <img
                    src={resolveAssetUrl(player.profile_picture)}
                    alt={player.name}
                    className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                  />
                ) : (
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 font-semibold">{player.name.charAt(0)}</span>
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{player.name}</p>
                </div>
              </button>
            ))}

            {players.length === 0 && (
              <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                <p>Noch keine registrierten Spieler im Team</p>
              </div>
            )}
          </div>
        </div>

        {user?.role === 'trainer' && <PlayerInviteManager teamId={teamId} />}
      </div>

      {/* Member Profile Modal */}
      {selectedMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="card max-w-md w-full max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="member-profile-title">
            <div className="flex items-start justify-between mb-4">
              <h3 id="member-profile-title" className="font-semibold text-gray-900 dark:text-white">
                Profil
              </h3>
              <button
                onClick={() => setSelectedMember(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="Schließen"
                aria-label="Modal schließen"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex justify-center">
                {resolveAssetUrl(selectedMember.profile_picture) ? (
                  <img
                    src={resolveAssetUrl(selectedMember.profile_picture)}
                    alt={selectedMember.name}
                    className="w-32 h-32 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                  />
                ) : (
                  <div className={`w-32 h-32 rounded-full flex items-center justify-center border-2 ${
                    selectedMember.role === 'trainer'
                      ? 'bg-primary-100 border-primary-200 dark:bg-primary-900/40 dark:border-primary-700'
                      : 'bg-green-100 border-green-200 dark:bg-green-900/40 dark:border-green-700'
                  }`}>
                    <span className={`text-5xl font-semibold ${
                      selectedMember.role === 'trainer'
                        ? 'text-primary-600 dark:text-primary-300'
                        : 'text-green-600 dark:text-green-300'
                    }`}>
                      {selectedMember.name.charAt(0)}
                    </span>
                  </div>
                )}
              </div>

              <div className="text-center">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedMember.name}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                  {selectedMember.role === 'trainer' ? 'Trainer' : 'Spieler'}
                </p>
                {selectedMember.nickname && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">„{selectedMember.nickname}“</p>
                )}
              </div>

              {selectedMember.role === 'player' && (
                (() => {
                  const hasJerseyNumber = selectedMember.jersey_number !== null && selectedMember.jersey_number !== undefined && selectedMember.jersey_number !== '';
                  const hasPosition = Boolean(selectedMember.position);
                  const hasHeight = Boolean(selectedMember.height_cm);
                  const hasWeight = Boolean(selectedMember.weight_kg);
                  const hasClothingSize = Boolean(selectedMember.clothing_size);
                  const hasShoeSize = Boolean(selectedMember.shoe_size);
                  const hasFootedness = Boolean(selectedMember.footedness);
                  const hasAnyPlayerInfo = hasJerseyNumber || hasPosition || hasHeight || hasWeight || hasClothingSize || hasShoeSize || hasFootedness;

                  if (!hasAnyPlayerInfo) {
                    return (
                      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                        Keine Daten hinterlegt.
                      </p>
                    );
                  }

                  return (
                    <div className="grid grid-cols-2 gap-3 text-center">
                      {hasJerseyNumber && (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Trikotnummer</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">#{selectedMember.jersey_number}</p>
                        </div>
                      )}

                      {hasPosition && (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Position</p>
                          <p className="text-sm text-gray-900 dark:text-white">{selectedMember.position}</p>
                        </div>
                      )}

                      {hasHeight && (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Größe</p>
                          <p className="text-sm text-gray-900 dark:text-white">{selectedMember.height_cm} cm</p>
                        </div>
                      )}

                      {hasWeight && (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Gewicht</p>
                          <p className="text-sm text-gray-900 dark:text-white">{selectedMember.weight_kg} kg</p>
                        </div>
                      )}

                      {hasClothingSize && (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Kleidergröße</p>
                          <p className="text-sm text-gray-900 dark:text-white">{selectedMember.clothing_size}</p>
                        </div>
                      )}

                      {hasShoeSize && (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Schuhgröße</p>
                          <p className="text-sm text-gray-900 dark:text-white">{selectedMember.shoe_size}</p>
                        </div>
                      )}

                      {hasFootedness && (
                        <div className="col-span-2">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Füßigkeit</p>
                          <p className="text-sm text-gray-900 dark:text-white capitalize">{selectedMember.footedness}</p>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}

              {selectedMember.role === 'trainer' && (
                (() => {
                  const hasPhoneNumber = Boolean(selectedMember.phone_number);
                  const hasEmail = Boolean(selectedMember.email);
                  const hasAnyTrainerInfo = hasPhoneNumber || hasEmail;

                  if (!hasAnyTrainerInfo) {
                    return (
                      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                        Keine Daten hinterlegt.
                      </p>
                    );
                  }

                  return (
                    <div className="space-y-3 text-center">
                      {hasPhoneNumber && (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Handynummer</p>
                          <p className="text-sm text-gray-900 dark:text-white">{selectedMember.phone_number}</p>
                        </div>
                      )}

                      {hasEmail && (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">E-Mail</p>
                          <p className="text-sm text-gray-900 dark:text-white break-all">{selectedMember.email}</p>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}

              <button
                onClick={() => setSelectedMember(null)}
                className="btn btn-secondary w-full"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
