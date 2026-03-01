import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { eventsAPI } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { resolveAssetUrl } from '../lib/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { ArrowLeft, MapPin, Clock, MessageSquare, Trash2, AlertCircle, Pencil, Calendar, Cone, Swords } from 'lucide-react';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id!);
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedStatus, setSelectedStatus] = useState<'accepted' | 'declined' | 'tentative'>('accepted');
  const [comment, setComment] = useState('');
  const [expandedResponseUserId, setExpandedResponseUserId] = useState<number | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      const response = await eventsAPI.getById(eventId);
      return response.data;
    },
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
      setExpandedResponseUserId(null);
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
  const handleTrainerStatusChangeFromModule = (userId: number, targetStatus: string) => {
    if (!isTrainer || updatePlayerResponseMutation.isPending) return;
    updatePlayerResponseMutation.mutate({
      userId,
      status: targetStatus,
    });
  };

  const renderTrainerStatusActions = (userId: number, currentStatus: string) => {
    if (!isTrainer || expandedResponseUserId !== userId) return null;

    const getActionClass = (status: string) => {
      const isActive = currentStatus === status;
      const base = 'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold transition-colors';

      if (status === 'accepted') {
        return `${base} ${isActive ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50'}`;
      }

      if (status === 'tentative') {
        return `${base} ${isActive ? 'bg-yellow-600 text-white' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:hover:bg-yellow-900/50'}`;
      }

      if (status === 'declined') {
        return `${base} ${isActive ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50'}`;
      }

      return `${base} ${isActive ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`;
    };

    return (
      <div className="ml-auto flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => handleTrainerStatusChangeFromModule(userId, 'accepted')}
          disabled={updatePlayerResponseMutation.isPending}
          className={getActionClass('accepted')}
          title="Zugesagt"
          aria-label="Zugesagt"
        >
          ✓
        </button>
        <button
          type="button"
          onClick={() => handleTrainerStatusChangeFromModule(userId, 'tentative')}
          disabled={updatePlayerResponseMutation.isPending}
          className={getActionClass('tentative')}
          title="Vielleicht"
          aria-label="Vielleicht"
        >
          ?
        </button>
        <button
          type="button"
          onClick={() => handleTrainerStatusChangeFromModule(userId, 'declined')}
          disabled={updatePlayerResponseMutation.isPending}
          className={getActionClass('declined')}
          title="Abgesagt"
          aria-label="Abgesagt"
        >
          ✗
        </button>
        <button
          type="button"
          onClick={() => handleTrainerStatusChangeFromModule(userId, 'pending')}
          disabled={updatePlayerResponseMutation.isPending}
          className={getActionClass('pending')}
          title="Keine Rückmeldung"
          aria-label="Keine Rückmeldung"
        >
          ⏳
        </button>
      </div>
    );
  };

  const getOpponentName = () => {
    if (!event?.title) return '';
    const parts = event.title.split(' - ');
    if (parts.length === 2) {
      const trimmedTeamName = String(event?.team_name || '').trim();
      const part1 = parts[0].trim();
      const part2 = parts[1].trim();
      return part1 === trimmedTeamName ? part2 : part1;
    }
    return event.title;
  };

  const opponent = getOpponentName();
  const displayTitle = String(opponent || event?.title || '').replace(/^spiel\s+gegen\s+/i, '').trim();
  const opponentCrestUrl = typeof event?.opponent_crest_url === 'string' ? event.opponent_crest_url.trim() : '';

  const getInitials = (name: string) => {
    return String(name || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('');
  };

  const renderAvatar = (name: string, profilePicture?: string, sizeClass = 'w-8 h-8') => {
    const avatarUrl = resolveAssetUrl(profilePicture);
    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt={`${name} Profilbild`}
          className={`${sizeClass} rounded-full object-cover border border-gray-200 dark:border-gray-700 bg-white`}
          loading="lazy"
        />
      );
    }

    return (
      <div className={`${sizeClass} rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold flex items-center justify-center`}>
        {getInitials(name)}
      </div>
    );
  };

  const eventDateLabel = format(new Date(event?.start_time), 'PPP', { locale: de });
  const eventTimeRangeLabel = `${format(new Date(event?.start_time), 'p', { locale: de })} - ${format(new Date(event?.end_time), 'p', { locale: de })}`;
  const locationLabel = ([event?.location_venue, event?.location_street, event?.location_zip_city]
    .filter(Boolean)
    .join(', ') || event?.location || '').trim();
  const hasMeetingInfo = (event?.meeting_point && String(event.meeting_point).trim().length > 0)
    || (event?.arrival_minutes !== null && event?.arrival_minutes !== undefined);

  const renderResponseModule = (
    title: string,
    count: number,
    toneClass: string,
    icon: string,
    responses: any[],
    currentStatus: 'accepted' | 'declined' | 'tentative' | 'pending'
  ) => {
    if (count === 0) return null;

    return (
      <div className="card">
        <h3 className={`font-semibold text-base sm:text-lg mb-3 flex items-center justify-between ${toneClass}`}>
          <span className="flex items-center">
            <span className="mr-2">{icon}</span>
            {title}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
            {count}
          </span>
        </h3>
        <div className="space-y-2">
          {responses.map((response: any) => (
            <div
              key={response.id}
              onClick={() => isTrainer && setExpandedResponseUserId((prev) => (prev === response.user_id ? null : response.user_id))}
              className="w-full flex items-center space-x-2 sm:space-x-3 text-sm rounded-lg px-2 py-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {renderAvatar(response.user_name, response.user_profile_picture)}
              <span className="text-gray-900 dark:text-white font-medium truncate">{response.user_name}</span>
              {renderTrainerStatusActions(response.user_id, currentStatus)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 sm:space-y-6">
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
            {event?.type === 'match' && opponentCrestUrl ? (
              <img
                src={opponentCrestUrl}
                alt={`${displayTitle || 'Gegner'} Wappen`}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-contain bg-white"
                loading="lazy"
              />
            ) : event?.type === 'training' ? (
              <Cone className="w-7 h-7 sm:w-8 sm:h-8 text-gray-700 dark:text-gray-300 shrink-0" />
            ) : event?.type === 'match' ? (
              <Swords className="w-7 h-7 sm:w-8 sm:h-8 text-gray-700 dark:text-gray-300 shrink-0" />
            ) : (
              <Calendar className="w-7 h-7 sm:w-8 sm:h-8 text-gray-700 dark:text-gray-300 shrink-0" />
            )}
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white break-words">{displayTitle || opponent || event?.title}</h1>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Event Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-white">Termindetails</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3 sm:p-4">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Datum</p>
                <p className="mt-1 font-semibold text-gray-900 dark:text-white">{eventDateLabel}</p>
              </div>

              <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3 sm:p-4">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Uhrzeit</p>
                <p className="mt-1 font-semibold text-gray-900 dark:text-white">{eventTimeRangeLabel}</p>
              </div>

              {locationLabel && (
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3 sm:p-4 sm:col-span-2">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Ort</p>
                  <p className="mt-1 font-semibold text-gray-900 dark:text-white break-words">{locationLabel}</p>
                </div>
              )}

              {hasMeetingInfo && (
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3 sm:p-4 sm:col-span-2">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Treffpunkt</p>
                  {event?.meeting_point && (
                    <p className="mt-1 font-semibold text-gray-900 dark:text-white break-words">{event.meeting_point}</p>
                  )}
                  {event?.arrival_minutes !== null && event?.arrival_minutes !== undefined && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
                      {event.arrival_minutes} Minuten vor Beginn
                    </p>
                  )}
                </div>
              )}

              {event?.type === 'match' && event?.is_home_match !== undefined && (
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3 sm:p-4">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Spielart</p>
                  <p className="mt-1 font-semibold text-gray-900 dark:text-white">{event.is_home_match ? 'Heimspiel' : 'Auswärtsspiel'}</p>
                </div>
              )}

              {event?.duration_minutes && (
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3 sm:p-4">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Dauer</p>
                  <p className="mt-1 font-semibold text-gray-900 dark:text-white">{event.duration_minutes} Minuten</p>
                </div>
              )}

              {event?.pitch_type && (
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3 sm:p-4 sm:col-span-2">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Platzart</p>
                  <p className="mt-1 font-semibold text-gray-900 dark:text-white">{event.pitch_type}</p>
                </div>
              )}

              {event?.rsvp_deadline && (
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3 sm:p-4 sm:col-span-2">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Rückmeldefrist</p>
                  <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                    {format(new Date(event.rsvp_deadline), 'PPPp', { locale: de })}
                  </p>
                </div>
              )}

              {event?.description && (
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3 sm:p-4 sm:col-span-2">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Beschreibung</p>
                  <p className="text-gray-700 dark:text-gray-300 break-words mt-1">{event.description}</p>
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

        </div>

        {/* Responses Overview */}
        <div className="space-y-4">
          {canViewResponses ? (
            <>
              {renderResponseModule(
                'Zugesagt',
                acceptedResponses.length,
                'text-green-700 dark:text-green-300',
                '✓',
                acceptedResponses,
                'accepted'
              )}

              {renderResponseModule(
                'Abgesagt',
                declinedResponses.length,
                'text-red-700 dark:text-red-300',
                '✗',
                declinedResponses,
                'declined'
              )}

              {renderResponseModule(
                'Vielleicht',
                tentativeResponses.length,
                'text-yellow-700 dark:text-yellow-300',
                '?',
                tentativeResponses,
                'tentative'
              )}

              {renderResponseModule(
                'Keine Antwort',
                pendingResponses.length,
                'text-gray-700 dark:text-gray-300',
                '⏳',
                pendingResponses,
                'pending'
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
