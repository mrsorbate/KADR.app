import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { eventsAPI } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Calendar, Plus, ArrowLeft, MapPin, Clock, MoreHorizontal, Check, X, HelpCircle } from 'lucide-react';

export default function EventsPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const teamId = id ? parseInt(id) : null;
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [openQuickActionsEventId, setOpenQuickActionsEventId] = useState<number | null>(null);
  const isTrainer = user?.role === 'trainer';
  const createdSuccess = searchParams.get('created') === '1';

  const updateResponseMutation = useMutation({
    mutationFn: (data: { eventId: number; status: string }) =>
      eventsAPI.updateResponse(data.eventId, { status: data.status }),
    onSuccess: () => {
      if (teamId) {
        queryClient.invalidateQueries({ queryKey: ['events', teamId] });
      }
      queryClient.invalidateQueries({ queryKey: ['all-events'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-events'] });
    },
  });

  // Query all events or team events based on URL param
  const { data: events, isLoading } = useQuery({
    queryKey: teamId ? ['events', teamId] : ['all-events'],
    queryFn: async () => {
      if (teamId) {
        const response = await eventsAPI.getAll(teamId);
        return response.data;
      } else {
        const response = await eventsAPI.getMyAll();
        return response.data;
      }
    },
  });


  if (isLoading) {
    return <div className="text-center py-12 text-gray-600 dark:text-gray-300">Lädt...</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <Link to={teamId ? `/teams/${teamId}` : '/'} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            {teamId ? 'Termine' : 'Alle Termine'}
          </h1>
        </div>

        {isTrainer && (
          <Link
            to={teamId ? `/teams/${teamId}/events/new` : '/events/new'}
            className="btn btn-primary w-full sm:w-auto flex items-center justify-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Termin erstellen</span>
          </Link>
        )}
      </div>

      {createdSuccess && (
        <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-800 dark:text-green-200">
          Termin wurde erfolgreich erstellt.
        </div>
      )}

      {/* Events List */}
      <div className="space-y-4">
        {events?.map((event: any) => {
          const getActionButtonClass = (status: string) => {
            const isSelected = event.my_status === status;
            const baseClass = 'w-9 h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-50';

            if (status === 'accepted') {
              return `${baseClass} ${isSelected ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50'}`;
            }

            if (status === 'declined') {
              return `${baseClass} ${isSelected ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50'}`;
            }

            return `${baseClass} ${isSelected ? 'bg-yellow-600 text-white' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:hover:bg-yellow-900/50'}`;
          };

          const locationParts = [event.location_venue, event.location_street, event.location_zip_city].filter(Boolean);
          const locationText = locationParts.length ? locationParts.join(', ') : event.location;

          return (
          <div
            key={event.id}
            onClick={() => navigate(`/events/${event.id}`)}
            className="block p-4 rounded-lg border-2 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md transition-all"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <span className="text-2xl">
                    {event.type === 'training' && '🏃'}
                    {event.type === 'match' && '⚽'}
                    {event.type === 'other' && '📅'}
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{event.title}</h3>
                  </div>
                </div>
                
                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300 ml-0 sm:ml-11">
                  {locationText ? (
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-4 h-4" />
                      <span>{locationText}</span>
                    </div>
                  ) : null}
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4" />
                    <span>
                      {format(new Date(event.start_time), 'PPp', { locale: de })}
                    </span>
                  </div>
                </div>

                {event.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{event.description}</p>
                )}
              </div>

              {/* Response Stats */}
              <div className="flex flex-col items-start sm:items-end gap-2 sm:ml-4">
                <div className="flex items-center gap-2">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="inline-flex items-center space-x-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-full">
                      <span className="font-semibold">✓</span>
                      <span>{event.accepted_count}</span>
                    </span>
                    <span className="inline-flex items-center space-x-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs rounded-full">
                      <span className="font-semibold">✗</span>
                      <span>{event.declined_count}</span>
                    </span>
                    <span className="inline-flex items-center space-x-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs rounded-full">
                      <span className="font-semibold">?</span>
                      <span>{event.tentative_count}</span>
                    </span>
                    <span className="inline-flex items-center space-x-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-full">
                      <span className="font-semibold">⏳</span>
                      <span>{event.pending_count}</span>
                    </span>
                  </div>

                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setOpenQuickActionsEventId((prev) => (prev === event.id ? null : event.id));
                      }}
                      className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      title="Antwortoptionen"
                      aria-label="Antwortoptionen öffnen"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </button>

                    {openQuickActionsEventId === event.id && (
                      <div className="absolute right-0 top-11 sm:top-1/2 sm:-translate-y-1/2 sm:right-full sm:mr-2 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-2 py-2 shadow-lg flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            updateResponseMutation.mutate({ eventId: event.id, status: 'accepted' });
                            setOpenQuickActionsEventId(null);
                          }}
                          disabled={updateResponseMutation.isPending}
                          className={getActionButtonClass('accepted')}
                          title="Zusagen"
                          aria-label="Zusagen"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            updateResponseMutation.mutate({ eventId: event.id, status: 'tentative' });
                            setOpenQuickActionsEventId(null);
                          }}
                          disabled={updateResponseMutation.isPending}
                          className={getActionButtonClass('tentative')}
                          title="Unsicher"
                          aria-label="Unsicher"
                        >
                          <HelpCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            updateResponseMutation.mutate({ eventId: event.id, status: 'declined' });
                            setOpenQuickActionsEventId(null);
                          }}
                          disabled={updateResponseMutation.isPending}
                          className={getActionButtonClass('declined')}
                          title="Absagen"
                          aria-label="Absagen"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          );
        })}
        {events?.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Calendar className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <p className="text-lg font-medium text-gray-900 dark:text-white">Noch keine Termine</p>
            <p className="text-sm mt-2">
              {teamId ? (
                isTrainer ? 'Erstelle den ersten Termin!' : 'Warte auf Termine vom Trainer.'
              ) : (
                'Keine zukünftigen Termine anstehend.'
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
