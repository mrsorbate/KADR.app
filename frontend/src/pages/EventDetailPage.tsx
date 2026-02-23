import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { eventsAPI, teamsAPI } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { ArrowLeft, MapPin, Clock, User, MessageSquare, Trash2, AlertCircle, Pencil } from 'lucide-react';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id!);
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedStatus, setSelectedStatus] = useState<'accepted' | 'declined' | 'tentative'>('accepted');
  const [comment, setComment] = useState('');

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      const response = await eventsAPI.getById(eventId);
      return response.data;
    },
  });

  // Get team membership to check if user is trainer
  const { data: members } = useQuery({
    queryKey: ['team-members', event?.team_id],
    queryFn: async () => {
      const response = await teamsAPI.getMembers(event!.team_id);
      return response.data;
    },
    enabled: !!event?.team_id,
  });

  const updateResponseMutation = useMutation({
    mutationFn: (data: { status: string; comment?: string }) =>
      eventsAPI.updateResponse(eventId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      setComment('');
    },
  });

  // Mutation for trainer to update player response
  const updatePlayerResponseMutation = useMutation({
    mutationFn: (data: { userId: number; status: string }) =>
      eventsAPI.updatePlayerResponse(eventId, data.userId, { status: data.status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: (deleteSeries: boolean) => eventsAPI.delete(eventId, deleteSeries),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      navigate(`/teams/${event?.team_id}/events`);
    },
  });

  const handleDeleteEvent = (deleteSeries: boolean = false) => {
    deleteEventMutation.mutate(deleteSeries);
    setDeleteModalOpen(false);
  };

  const handleResponse = (e: React.FormEvent) => {
    e.preventDefault();
    updateResponseMutation.mutate({
      status: selectedStatus,
      comment: comment || undefined,
    });
  };

  if (isLoading) {
    return <div className="text-center py-12 text-gray-600 dark:text-gray-300">Lädt...</div>;
  }

  const myResponse = event?.responses?.find((r: any) => r.user_id === user?.id);
  const acceptedResponses = event?.responses?.filter((r: any) => r.status === 'accepted') || [];
  const declinedResponses = event?.responses?.filter((r: any) => r.status === 'declined') || [];
  const tentativeResponses = event?.responses?.filter((r: any) => r.status === 'tentative') || [];
  const pendingResponses = event?.responses?.filter((r: any) => r.status === 'pending') || [];
  
  const isTrainer = user?.role === 'trainer';
  const isVisibilityAll = event?.visibility_all === 1 || event?.visibility_all === true;
  const canViewResponses = isTrainer || isVisibilityAll;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-start sm:items-center space-x-3 sm:space-x-4">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          aria-label="Zurück"
          title="Zurück"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <span className="text-2xl sm:text-3xl">
              {event?.type === 'training' && '🏃'}
              {event?.type === 'match' && '⚽'}
              {event?.type === 'other' && '📅'}
            </span>
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white break-words">{event?.title}</h1>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Event Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Details</h2>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {format(new Date(event?.start_time), 'PPP', { locale: de })}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {format(new Date(event?.start_time), 'p', { locale: de })} -{' '}
                    {format(new Date(event?.end_time), 'p', { locale: de })}
                  </p>
                </div>
              </div>

              {event?.duration_minutes && (
                <div className="flex items-start space-x-3">
                  <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Dauer</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{event.duration_minutes} Minuten</p>
                  </div>
                </div>
              )}

              {event?.type === 'match' && event?.is_home_match !== undefined && (
                <div className="flex items-start space-x-3">
                  <span className="text-xl mt-0.5">{event.is_home_match ? '🏠' : '🚗'}</span>
                  <div>
                    <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      event.is_home_match
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                    }`}>
                      {event.is_home_match ? 'Heimspiel' : 'Auswärtsspiel'}
                    </div>
                  </div>
                </div>
              )}

              {(event?.location_venue || event?.location_street || event?.location_zip_city || event?.location) && (
                <div className="flex items-start space-x-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    {event?.location_venue && (
                      <p className="font-medium text-gray-900 dark:text-white">{event.location_venue}</p>
                    )}
                    {event?.location_street && (
                      <p className="text-sm text-gray-600 dark:text-gray-300">{event.location_street}</p>
                    )}
                    {event?.location_zip_city && (
                      <p className="text-sm text-gray-600 dark:text-gray-300">{event.location_zip_city}</p>
                    )}
                    {!event?.location_venue && !event?.location_street && !event?.location_zip_city && event?.location && (
                      <p className="font-medium text-gray-900 dark:text-white">{event.location}</p>
                    )}
                  </div>
                </div>
              )}

              {event?.pitch_type && (
                <div className="flex items-start space-x-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Platzart</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{event.pitch_type}</p>
                  </div>
                </div>
              )}

              {event?.meeting_point && (
                <div className="flex items-start space-x-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Treffpunkt</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{event.meeting_point}</p>
                  </div>
                </div>
              )}

              {event?.arrival_minutes !== null && event?.arrival_minutes !== undefined && (
                <div className="flex items-start space-x-3">
                  <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Treffen</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{event.arrival_minutes} Minuten vor Beginn</p>
                  </div>
                </div>
              )}

              {event?.rsvp_deadline && (
                <div className="flex items-start space-x-3">
                  <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Rueckmeldefrist</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {format(new Date(event.rsvp_deadline), 'PPPp', { locale: de })}
                    </p>
                  </div>
                </div>
              )}

              {event?.description && (
                <div className="flex items-start space-x-3">
                  <MessageSquare className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-gray-700 dark:text-gray-300">{event.description}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Your Response */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Deine Rückmeldung</h2>
            {myResponse && myResponse.status !== 'pending' ? (
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">Aktuelle Antwort:</p>
                <p className="font-medium">
                  {myResponse.status === 'accepted' && '✓ Zugesagt'}
                  {myResponse.status === 'declined' && '✗ Abgesagt'}
                  {myResponse.status === 'tentative' && '? Vielleicht'}
                </p>
                {myResponse.comment && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{myResponse.comment}</p>
                )}
              </div>
            ) : null}

            <form onSubmit={handleResponse} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedStatus('accepted')}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                    selectedStatus === 'accepted'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500 dark:hover:bg-gray-500'
                  }`}
                >
                  ✓ Zusagen
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStatus('tentative')}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                    selectedStatus === 'tentative'
                      ? 'bg-yellow-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500 dark:hover:bg-gray-500'
                  }`}
                >
                  ? Vielleicht
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStatus('declined')}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                    selectedStatus === 'declined'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500 dark:hover:bg-gray-500'
                  }`}
                >
                  ✗ Absagen
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Kommentar (optional)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="input"
                  rows={2}
                  placeholder="z.B. Komme später..."
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={updateResponseMutation.isPending}
              >
                {updateResponseMutation.isPending ? 'Wird gespeichert...' : 'Rückmeldung speichern'}
              </button>
            </form>
          </div>

          {/* Trainer: Manage Player Responses */}
          {isTrainer && members && (
            <div className="card border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
              <h2 className="text-xl font-semibold mb-4 text-blue-900 dark:text-blue-100">Spieler-Rückmeldungen verwalten</h2>
              <div className="space-y-2">
                {members
                  .filter((m: any) => m.id !== user?.id) // Exclude trainer themselves
                  .map((member: any) => {
                    const response = event?.responses?.find((r: any) => r.user_id === member.id);
                    const status = response?.status || 'pending';
                    
                    const getStatusColor = (s: string) => {
                      switch (s) {
                        case 'accepted': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
                        case 'declined': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
                        case 'tentative': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
                        default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
                      }
                    };

                    const getStatusLabel = (s: string) => {
                      switch (s) {
                        case 'accepted': return '✓ Zugesagt';
                        case 'declined': return '✗ Abgesagt';
                        case 'tentative': return '? Vielleicht';
                        default: return '⏳ Keine Antwort';
                      }
                    };

                    return (
                      <div key={member.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <User className="w-5 h-5 text-gray-400" />
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white break-words">{member.name}</p>
                            {member.position && <p className="text-xs text-gray-500 dark:text-gray-400">{member.position}</p>}
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-1 text-xs rounded font-medium ${getStatusColor(status)}`}>
                            {getStatusLabel(status)}
                          </span>
                          
                          <select
                            value={status}
                            onChange={(e) => {
                              updatePlayerResponseMutation.mutate({
                                userId: member.id,
                                status: e.target.value
                              });
                            }}
                            disabled={updatePlayerResponseMutation.isPending}
                            title="Rückmeldestatus ändern"
                            aria-label="Rückmeldestatus ändern"
                            className="text-sm px-2 py-1 rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 cursor-pointer hover:border-blue-500"
                          >
                            <option value="accepted">Zugesagt</option>
                            <option value="declined">Abgesagt</option>
                            <option value="tentative">Vielleicht</option>
                            <option value="pending">Keine Antwort</option>
                          </select>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Responses Overview */}
        <div className="space-y-4">
          {canViewResponses ? (
            <>
              <div className="card">
                <h3 className="font-semibold text-green-700 dark:text-green-300 mb-3 flex items-center">
                  <span className="mr-2">✓</span>
                  Zugesagt ({acceptedResponses.length})
                </h3>
                <div className="space-y-2">
                  {acceptedResponses.map((response: any) => (
                    <div key={response.id} className="flex items-center space-x-2 text-sm">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-900 dark:text-white">{response.user_name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <h3 className="font-semibold text-red-700 dark:text-red-300 mb-3 flex items-center">
                  <span className="mr-2">✗</span>
                  Abgesagt ({declinedResponses.length})
                </h3>
                <div className="space-y-2">
                  {declinedResponses.map((response: any) => (
                    <div key={response.id} className="text-sm">
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900 dark:text-white">{response.user_name}</span>
                      </div>
                      {response.comment && (
                        <p className="text-gray-600 dark:text-gray-300 text-xs mt-1 ml-6">{response.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {tentativeResponses.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold text-yellow-700 dark:text-yellow-300 mb-3 flex items-center">
                    <span className="mr-2">?</span>
                    Vielleicht ({tentativeResponses.length})
                  </h3>
                  <div className="space-y-2">
                    {tentativeResponses.map((response: any) => (
                      <div key={response.id} className="flex items-center space-x-2 text-sm">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900 dark:text-white">{response.user_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pendingResponses.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                    <span className="mr-2">⏳</span>
                    Keine Antwort ({pendingResponses.length})
                  </h3>
                  <div className="space-y-2">
                    {pendingResponses.map((response: any) => (
                      <div key={response.id} className="flex items-center space-x-2 text-sm">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900 dark:text-white">{response.user_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="card">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Teilnehmerliste</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">Die Teilnehmerliste ist nur fuer Trainer sichtbar.</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Button Section */}
      {isTrainer && (
        <div className="card border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 space-y-3">
          <Link
            to={`/events/${eventId}/edit`}
            className="w-full btn btn-secondary flex items-center justify-center space-x-2"
          >
            <Pencil className="w-5 h-5" />
            <span>Termin bearbeiten</span>
          </Link>
          <button
            onClick={() => setDeleteModalOpen(true)}
            disabled={deleteEventMutation.isPending}
            className="w-full btn bg-red-600 text-white hover:bg-red-700 flex items-center justify-center space-x-2"
          >
            <Trash2 className="w-5 h-5" />
            <span>Termin löschen</span>
          </button>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModalOpen && event?.series_id && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card max-w-md w-full mx-4">
            <div className="flex items-start space-x-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Termin löschen</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  Dieser Termin ist teil einer Serie. Wie möchtest du vorgehen?
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleDeleteEvent(false)}
                disabled={deleteEventMutation.isPending}
                className="w-full btn btn-secondary"
              >
                Nur diesen Termin löschen
              </button>
              <button
                onClick={() => handleDeleteEvent(true)}
                disabled={deleteEventMutation.isPending}
                className="w-full btn bg-red-600 text-white hover:bg-red-700"
              >
                Gesamte Serie löschen ({event?.series_id ? '?' : '?'})
              </button>
              <button
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleteEventMutation.isPending}
                className="w-full btn btn-secondary"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simple delete confirmation for non-series events */}
      {deleteModalOpen && !event?.series_id && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card max-w-md w-full mx-4">
            <div className="flex items-start space-x-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Termin löschen</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  Termin "{event?.title}" wirklich löschen? Dies kann nicht rückgängig gemacht werden.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleDeleteEvent(false)}
                disabled={deleteEventMutation.isPending}
                className="w-full btn bg-red-600 text-white hover:bg-red-700"
              >
                Löschen
              </button>
              <button
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleteEventMutation.isPending}
                className="w-full btn btn-secondary"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
