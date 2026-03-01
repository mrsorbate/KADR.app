import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, MapPin, Settings2 } from 'lucide-react';
import { eventsAPI, teamsAPI } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { resolveAssetUrl } from '../lib/utils';

export default function EventEditPage() {
  const { id } = useParams<{ id: string }>();
  const eventId = id ? parseInt(id, 10) : NaN;
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isTrainer = user?.role === 'trainer';

  const [eventData, setEventData] = useState({
    title: '',
    type: 'training' as 'training' | 'match' | 'other',
    description: '',
    location_venue: '',
    location_street: '',
    location_zip_city: '',
    pitch_type: '',
    meeting_point: '',
    arrival_minutes: '',
    start_time: '',
    duration_minutes: '',
    end_time: '',
    rsvp_deadline: '',
    visibility_all: true,
    invite_all: true,
    invited_user_ids: [] as number[],
  });
  const [inviteSelectionModalOpen, setInviteSelectionModalOpen] = useState(false);

  const stepDurationMinutes = (delta: number) => {
    setEventData((prev) => {
      const current = parseInt(prev.duration_minutes, 10);
      const baseValue = Number.isFinite(current) ? current : 5;
      const nextValue = Math.max(5, baseValue + delta);
      return { ...prev, duration_minutes: String(nextValue) };
    });
  };

  const stepArrivalMinutes = (delta: number) => {
    setEventData((prev) => {
      const current = parseInt(prev.arrival_minutes, 10);
      const baseValue = Number.isFinite(current) ? current : 0;
      const nextValue = Math.max(0, baseValue + delta);
      return { ...prev, arrival_minutes: String(nextValue) };
    });
  };

  const handleMinutesWheel = (
    event: React.WheelEvent<HTMLInputElement>,
    field: 'duration_minutes' | 'arrival_minutes'
  ) => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 5 : -5;
    if (field === 'duration_minutes') {
      stepDurationMinutes(delta);
      return;
    }
    stepArrivalMinutes(delta);
  };

  const categoryOptions: Array<{ value: 'training' | 'match' | 'other'; label: string }> = [
    { value: 'training', label: 'Training' },
    { value: 'match', label: 'Spiel' },
    { value: 'other', label: 'Sonstiges' },
  ];

  const pitchTypeOptions: Array<{ value: string; label: string }> = [
    { value: 'Rasen', label: 'Rasen' },
    { value: 'Kunstrasen', label: 'Kunstrasen' },
    { value: 'Halle', label: 'Halle' },
    { value: 'Sonstiges', label: 'Sonstiges' },
  ];

  const getInitials = (name: string): string => {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  };

  const toLocalInputValue = (value?: string | null): string => {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const formatLocalDateTime = (date: Date): string => {
    const pad = (value: number) => value.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const applyRsvpDeadlineOffsetHours = (hoursBefore: number) => {
    if (!eventData.start_time) {
      return;
    }

    const startDate = new Date(eventData.start_time);
    if (Number.isNaN(startDate.getTime())) {
      return;
    }

    const normalizedHours = Math.max(0, Math.min(168, Math.round(hoursBefore)));
    const deadlineDate = new Date(startDate.getTime() - normalizedHours * 60 * 60 * 1000);
    setEventData((prev) => ({ ...prev, rsvp_deadline: formatLocalDateTime(deadlineDate) }));
  };

  const getCurrentRsvpDeadlineOffsetHours = (): string => {
    if (!eventData.start_time || !eventData.rsvp_deadline) {
      return '';
    }

    const startDate = new Date(eventData.start_time);
    const deadlineDate = new Date(eventData.rsvp_deadline);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(deadlineDate.getTime())) {
      return '';
    }

    const diffMs = startDate.getTime() - deadlineDate.getTime();
    if (diffMs < 0) {
      return '0';
    }

    const diffHours = Math.round(diffMs / (60 * 60 * 1000));
    return String(Math.min(168, Math.max(0, diffHours)));
  };

  const getCategoryDefaultRsvpHours = (
    settings: any,
    type: 'training' | 'match' | 'other'
  ): number | null => {
    const parseHours = (value: unknown): number | null => {
      if (value === null || value === undefined || String(value).trim() === '') {
        return null;
      }
      const parsed = parseInt(String(value), 10);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 168) {
        return null;
      }
      return parsed;
    };

    const typeValue =
      type === 'training'
        ? settings?.default_rsvp_deadline_hours_training
        : type === 'match'
          ? settings?.default_rsvp_deadline_hours_match
          : settings?.default_rsvp_deadline_hours_other;

    const fromType = parseHours(typeValue);
    if (fromType !== null) {
      return fromType;
    }

    return parseHours(settings?.default_rsvp_deadline_hours);
  };

  const getCategoryDefaultArrivalMinutes = (
    settings: any,
    type: 'training' | 'match' | 'other'
  ): number | null => {
    const parseMinutes = (value: unknown): number | null => {
      if (value === null || value === undefined || String(value).trim() === '') {
        return null;
      }
      const parsed = parseInt(String(value), 10);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 240) {
        return null;
      }
      return parsed;
    };

    const typeValue =
      type === 'training'
        ? settings?.default_arrival_minutes_training
        : type === 'match'
          ? settings?.default_arrival_minutes_match
          : settings?.default_arrival_minutes_other;

    const fromType = parseMinutes(typeValue);
    if (fromType !== null) {
      return fromType;
    }

    return parseMinutes(settings?.default_arrival_minutes);
  };

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      const response = await eventsAPI.getById(eventId);
      return response.data;
    },
    enabled: Number.isFinite(eventId),
  });

  const { data: teamSettings } = useQuery({
    queryKey: ['team-settings', event?.team_id],
    queryFn: async () => {
      const response = await teamsAPI.getSettings(event!.team_id);
      return response.data;
    },
    enabled: Boolean(event?.team_id),
  });

  const { data: membersForEdit } = useQuery({
    queryKey: ['team-members', event?.team_id],
    queryFn: async () => {
      const response = await teamsAPI.getMembers(event!.team_id);
      return response.data;
    },
    enabled: Boolean(event?.team_id),
  });

  const allMemberIds = membersForEdit?.map((member: any) => member.id) || [];

  const homeVenues = Array.isArray(teamSettings?.home_venues)
    ? teamSettings.home_venues.filter((venue: any) => venue && typeof venue === 'object' && String(venue.name || '').trim())
    : [];

  const defaultHomeVenue = (() => {
    if (!homeVenues.length) return null;
    const defaultHomeVenueName = String(teamSettings?.default_home_venue_name || '').trim();
    if (!defaultHomeVenueName) {
      return homeVenues[0];
    }
    return homeVenues.find((venue: any) => String(venue?.name || '').trim() === defaultHomeVenueName) || homeVenues[0];
  })();

  const applyHomeVenueByIndex = (indexValue: string) => {
    const index = parseInt(indexValue, 10);
    if (!Number.isFinite(index) || index < 0 || index >= homeVenues.length) {
      return;
    }
    const selectedVenue = homeVenues[index];
    setEventData((prev) => ({
      ...prev,
      location_venue: String(selectedVenue?.name || ''),
      location_street: String(selectedVenue?.street || ''),
      location_zip_city: String(selectedVenue?.zip_city || ''),
      pitch_type: String(selectedVenue?.pitch_type || ''),
    }));
  };

  useEffect(() => {
    if (!event) {
      return;
    }

    const parsedDuration = event.duration_minutes && Number.isFinite(Number(event.duration_minutes))
      ? String(event.duration_minutes)
      : (() => {
          const start = new Date(event.start_time);
          const end = new Date(event.end_time);
          if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return '';
          }
          return String(Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000)));
        })();

    const invitedUserIds: number[] = [];
    if (Array.isArray(event.responses)) {
      for (const response of event.responses as any[]) {
        const userId = Number(response?.user_id);
        if (Number.isFinite(userId) && !invitedUserIds.includes(userId)) {
          invitedUserIds.push(userId);
        }
      }
    }

    setEventData({
      title: event.title || '',
      type: (event.type || 'training') as 'training' | 'match' | 'other',
      description: event.description || '',
      location_venue: event.location_venue || event.location || '',
      location_street: event.location_street || '',
      location_zip_city: event.location_zip_city || '',
      pitch_type: event.pitch_type || '',
      meeting_point: event.meeting_point || '',
      arrival_minutes: event.arrival_minutes === null || event.arrival_minutes === undefined ? '' : String(event.arrival_minutes),
      start_time: toLocalInputValue(event.start_time),
      duration_minutes: parsedDuration,
      end_time: toLocalInputValue(event.end_time),
      rsvp_deadline: toLocalInputValue(event.rsvp_deadline),
      visibility_all: event.visibility_all === 1 || event.visibility_all === true,
      invite_all: event.invite_all === 1 || event.invite_all === true,
      invited_user_ids: invitedUserIds,
    });
  }, [event]);

  useEffect(() => {
    if (!eventData.invite_all || !allMemberIds.length) {
      return;
    }

    const hasAllMembersSelected = eventData.invited_user_ids.length === allMemberIds.length;
    if (!hasAllMembersSelected) {
      setEventData((prev) => ({ ...prev, invited_user_ids: allMemberIds }));
    }
  }, [eventData.invite_all, eventData.invited_user_ids.length, allMemberIds.length]);

  useEffect(() => {
    if (!eventData.start_time || !eventData.duration_minutes) {
      return;
    }

    const startDate = new Date(eventData.start_time);
    const minutes = parseInt(eventData.duration_minutes, 10);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(minutes)) {
      return;
    }

    const endDate = new Date(startDate.getTime() + minutes * 60000);
    const pad = (num: number) => String(num).padStart(2, '0');
    const formatted = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`;
    if (eventData.end_time !== formatted) {
      setEventData((prev) => ({ ...prev, end_time: formatted }));
    }
  }, [eventData.start_time, eventData.duration_minutes, eventData.end_time]);

  useEffect(() => {
    if (!defaultHomeVenue) {
      return;
    }

    const shouldUseDefaultVenue = eventData.type === 'training' || (eventData.type === 'match' && event?.is_home_match !== 0);
    if (!shouldUseDefaultVenue) {
      return;
    }

    const hasManualLocation = Boolean(
      String(eventData.location_venue || '').trim()
      || String(eventData.location_street || '').trim()
      || String(eventData.location_zip_city || '').trim()
    );

    if (hasManualLocation) {
      return;
    }

    setEventData((prev) => ({
      ...prev,
      location_venue: String(defaultHomeVenue?.name || ''),
      location_street: String(defaultHomeVenue?.street || ''),
      location_zip_city: String(defaultHomeVenue?.zip_city || ''),
      pitch_type: prev.pitch_type || String(defaultHomeVenue?.pitch_type || ''),
    }));
  }, [defaultHomeVenue, eventData.type, event?.is_home_match, eventData.location_venue, eventData.location_street, eventData.location_zip_city]);

  useEffect(() => {
    if (!eventData.start_time || eventData.rsvp_deadline) {
      return;
    }

    const defaultHours = getCategoryDefaultRsvpHours(teamSettings, eventData.type);
    if (defaultHours === null) {
      return;
    }

    applyRsvpDeadlineOffsetHours(defaultHours);
  }, [
    eventData.start_time,
    eventData.rsvp_deadline,
    eventData.type,
    teamSettings?.default_rsvp_deadline_hours,
    teamSettings?.default_rsvp_deadline_hours_training,
    teamSettings?.default_rsvp_deadline_hours_match,
    teamSettings?.default_rsvp_deadline_hours_other,
  ]);

  const updateEventMutation = useMutation({
    mutationFn: (data: any) => eventsAPI.update(eventId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      navigate(`/events/${eventId}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const dataToSend = {
      title: eventData.title,
      type: eventData.type,
      description: eventData.description || undefined,
      location: eventData.location_venue || undefined,
      location_venue: eventData.location_venue || undefined,
      location_street: eventData.location_street || undefined,
      location_zip_city: eventData.location_zip_city || undefined,
      pitch_type: eventData.pitch_type || undefined,
      meeting_point: eventData.meeting_point || undefined,
      arrival_minutes: eventData.arrival_minutes === '' ? undefined : parseInt(eventData.arrival_minutes, 10),
      start_time: new Date(eventData.start_time).toISOString(),
      end_time: new Date(eventData.end_time).toISOString(),
      rsvp_deadline: eventData.rsvp_deadline ? new Date(eventData.rsvp_deadline).toISOString() : undefined,
      duration_minutes: eventData.duration_minutes === '' ? undefined : parseInt(eventData.duration_minutes, 10),
      visibility_all: eventData.visibility_all,
      invite_all: eventData.invite_all,
      invited_user_ids: eventData.invited_user_ids,
    };

    updateEventMutation.mutate(dataToSend);
  };

  const openInviteSelectionModal = () => {
    if (!membersForEdit?.length) {
      return;
    }

    if (eventData.invited_user_ids.length === 0) {
      setEventData((prev) => ({ ...prev, invited_user_ids: allMemberIds, invite_all: true }));
    }

    setInviteSelectionModalOpen(true);
  };

  const closeInviteSelectionModal = () => {
    const inviteAll = allMemberIds.length > 0 && eventData.invited_user_ids.length === allMemberIds.length;
    setEventData((prev) => ({ ...prev, invite_all: inviteAll }));
    setInviteSelectionModalOpen(false);
  };

  if (!isTrainer) {
    return <Navigate to="/events" replace />;
  }

  if (isLoading) {
    return <div className="text-center py-12 text-gray-600 dark:text-gray-300">Lädt...</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Link to={`/events/${eventId}`} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white">Termin bearbeiten</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
          <div className="card space-y-4">
            <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary-600" />
              Termin
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Kategorie *</label>
              <div className="mt-1 grid grid-cols-3 gap-2" role="group" aria-label="Kategorie auswählen">
                {categoryOptions.map((option) => {
                  const isActive = eventData.type === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setEventData({ ...eventData, type: option.value })}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Platzart</label>
              <div className="mt-1 flex flex-wrap gap-2" role="group" aria-label="Platzart auswählen">
                {pitchTypeOptions.map((option) => {
                  const isActive = eventData.pitch_type === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setEventData({ ...eventData, pitch_type: option.value })}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Titel *</label>
              <input
                type="text"
                required
                value={eventData.title}
                onChange={(e) => setEventData({ ...eventData, title: e.target.value })}
                title="Titel"
                className="input mt-1"
              />
            </div>

            <div className="min-w-0">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Beginn *</label>
              <input
                type="datetime-local"
                required
                value={eventData.start_time}
                onChange={(e) => setEventData({ ...eventData, start_time: e.target.value })}
                title="Beginn"
                className="input mt-1 w-full min-w-0"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {eventData.start_time ? `Gewählt: ${eventData.start_time.replace('T', ' ')}` : 'Datum und Uhrzeit auswählen'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Dauer (Minuten) *</label>
              <div className="mt-1 flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => stepDurationMinutes(-5)}
                  className="btn btn-secondary w-12 px-0 shrink-0"
                  aria-label="Dauer verringern"
                >
                  −
                </button>
                <input
                  type="number"
                  min={5}
                  step={5}
                  required
                  value={eventData.duration_minutes}
                  onChange={(e) => setEventData({ ...eventData, duration_minutes: e.target.value })}
                  onWheel={(e) => handleMinutesWheel(e, 'duration_minutes')}
                  title="Dauer in Minuten"
                  className="input text-center flex-1 min-w-0"
                />
                <button
                  type="button"
                  onClick={() => stepDurationMinutes(5)}
                  className="btn btn-secondary w-12 px-0 shrink-0"
                  aria-label="Dauer erhöhen"
                >
                  +
                </button>
              </div>
            </div>
            </div>
          </div>

          <div className="card space-y-4">
            <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary-600" />
              Ort & Organisation
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(eventData.type === 'match' || eventData.type === 'training') && homeVenues.length > 0 && (
              <div className="md:col-span-2">
                <select
                  defaultValue=""
                  onChange={(e) => applyHomeVenueByIndex(e.target.value)}
                  className="input"
                  title="Ort oder Spielstätte auswählen"
                  aria-label="Ort oder Spielstätte auswählen"
                >
                  <option value="">Ort oder Spielstätte auswählen</option>
                  {homeVenues.map((venue: any, index: number) => (
                    <option key={`${venue.name}-${index}`} value={index}>
                      {venue.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Ort oder Spielstätte</label>
              <input
                type="text"
                value={eventData.location_venue}
                onChange={(e) => setEventData({ ...eventData, location_venue: e.target.value })}
                title="Ort oder Spielstätte"
                className="input mt-1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Strasse</label>
              <input
                type="text"
                value={eventData.location_street}
                onChange={(e) => setEventData({ ...eventData, location_street: e.target.value })}
                title="Strasse"
                className="input mt-1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">PLZ Ort</label>
              <input
                type="text"
                value={eventData.location_zip_city}
                onChange={(e) => setEventData({ ...eventData, location_zip_city: e.target.value })}
                title="PLZ Ort"
                className="input mt-1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Treffpunkt</label>
              <input
                type="text"
                value={eventData.meeting_point}
                onChange={(e) => setEventData({ ...eventData, meeting_point: e.target.value })}
                title="Treffpunkt"
                className="input mt-1"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Treffen vor Beginn (Minuten)</label>
                <button
                  type="button"
                  onClick={() => {
                    const categoryDefaultArrival = getCategoryDefaultArrivalMinutes(teamSettings, eventData.type);
                    setEventData((prev) => ({
                      ...prev,
                      arrival_minutes: categoryDefaultArrival === null ? '' : String(categoryDefaultArrival),
                    }));
                  }}
                  className="text-xs text-primary-600 hover:text-primary-500"
                >
                  Minuten auf Team-Default
                </button>
              </div>
              <div className="mt-1 flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => stepArrivalMinutes(-5)}
                  className="btn btn-secondary w-12 px-0 shrink-0"
                  aria-label="Ankunftsminuten verringern"
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={eventData.arrival_minutes}
                  onChange={(e) => setEventData({ ...eventData, arrival_minutes: e.target.value })}
                  onWheel={(e) => handleMinutesWheel(e, 'arrival_minutes')}
                  title="Treffen vor Beginn in Minuten"
                  className="input text-center flex-1 min-w-0"
                />
                <button
                  type="button"
                  onClick={() => stepArrivalMinutes(5)}
                  className="btn btn-secondary w-12 px-0 shrink-0"
                  aria-label="Ankunftsminuten erhöhen"
                >
                  +
                </button>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Beschreibung</label>
              <textarea
                value={eventData.description}
                onChange={(e) => setEventData({ ...eventData, description: e.target.value })}
                title="Beschreibung"
                className="input mt-1 min-h-[90px]"
              />
            </div>
            </div>
          </div>

          <div className="card space-y-4">
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-primary-600" />
                  Einstellungen
                </h4>

                <label className="flex items-center space-x-3">
                  <input
                    id="visibility_all"
                    type="checkbox"
                    checked={eventData.visibility_all}
                    onChange={(e) => setEventData({ ...eventData, visibility_all: e.target.checked })}
                    className="h-4 w-4 text-primary-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Teilnehmerliste für alle sichtbar</span>
                </label>

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Rückmeldefrist (Stunden vor Termin)</label>
                    <button
                      type="button"
                      onClick={() => {
                        const defaultHours = getCategoryDefaultRsvpHours(teamSettings, eventData.type);
                        if (defaultHours !== null) {
                          applyRsvpDeadlineOffsetHours(defaultHours);
                        }
                      }}
                      className="text-xs text-primary-600 hover:text-primary-500"
                    >
                      Team-Default
                    </button>
                  </div>
                  <div className="mt-1 flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (!eventData.start_time) return;
                        const current = parseInt(getCurrentRsvpDeadlineOffsetHours(), 10);
                        const baseValue = Number.isFinite(current) ? current : 0;
                        const nextValue = Math.max(0, Math.min(168, baseValue - 1));
                        applyRsvpDeadlineOffsetHours(nextValue);
                      }}
                      disabled={!eventData.start_time}
                      className="btn btn-secondary w-12 px-0 shrink-0"
                      aria-label="Rückmeldefrist Stunden verringern"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={168}
                      step={1}
                      value={getCurrentRsvpDeadlineOffsetHours()}
                      onChange={(e) => {
                        const value = parseInt(e.target.value, 10);
                        if (!Number.isFinite(value)) {
                          setEventData((prev) => ({ ...prev, rsvp_deadline: '' }));
                          return;
                        }
                        applyRsvpDeadlineOffsetHours(value);
                      }}
                      title="Stunden vor Termin"
                      aria-label="Rückmeldefrist in Stunden vor Termin"
                      disabled={!eventData.start_time}
                      className="input text-center flex-1 min-w-0"
                      placeholder="z.B. 24"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!eventData.start_time) return;
                        const current = parseInt(getCurrentRsvpDeadlineOffsetHours(), 10);
                        const baseValue = Number.isFinite(current) ? current : 0;
                        const nextValue = Math.max(0, Math.min(168, baseValue + 1));
                        applyRsvpDeadlineOffsetHours(nextValue);
                      }}
                      disabled={!eventData.start_time}
                      className="btn btn-secondary w-12 px-0 shrink-0"
                      aria-label="Rückmeldefrist Stunden erhöhen"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Frist endet am: {eventData.rsvp_deadline ? eventData.rsvp_deadline.replace('T', ' ') : '—'}
                  </p>
                </div>

                {membersForEdit?.length ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Teammitglieder</label>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={openInviteSelectionModal}
                        className="btn btn-secondary"
                      >
                        Teammitglieder auswählen
                      </button>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {eventData.invite_all
                          ? `Alle ${allMemberIds.length} Teammitglieder eingeladen`
                          : `${eventData.invited_user_ids.length} von ${allMemberIds.length} Teammitgliedern eingeladen`}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
          </div>

          <div className="flex justify-end gap-2">
            <Link to={`/events/${eventId}`} className="btn btn-secondary">
              Abbrechen
            </Link>
            <button type="submit" className="btn btn-primary" disabled={updateEventMutation.isPending}>
              {updateEventMutation.isPending ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
      </form>

      {inviteSelectionModalOpen && membersForEdit?.length ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Teilnehmer auswählen</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 mb-3">
              Wähle aus, welche Spieler eingeladen werden.
            </p>

            <div className="mb-3">
              <button
                type="button"
                onClick={() => setEventData((prev) => ({ ...prev, invited_user_ids: allMemberIds, invite_all: true }))}
                className="text-xs text-primary-600 hover:text-primary-500"
              >
                Alle auswählen
              </button>
            </div>

            <div className="overflow-y-auto pr-1 space-y-2">
              {membersForEdit.map((member: any) => {
                const isChecked = eventData.invited_user_ids.includes(member.id);
                const avatarUrl = resolveAssetUrl(member?.profile_picture);
                return (
                  <div key={member.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={`${member.name} Profilbild`}
                          className="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold flex items-center justify-center">
                          {getInitials(member.name)}
                        </div>
                      )}
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{member.name}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const nextIds = isChecked
                          ? eventData.invited_user_ids.filter((value) => value !== member.id)
                          : [...eventData.invited_user_ids, member.id];
                        const inviteAll = nextIds.length === allMemberIds.length;
                        setEventData((prev) => ({ ...prev, invited_user_ids: nextIds, invite_all: inviteAll }));
                      }}
                      className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        isChecked
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                      }`}
                    >
                      <span>{isChecked ? 'ON' : 'OFF'}</span>
                      <span
                        className={`w-3 h-3 rounded-full ${
                          isChecked ? 'bg-white' : 'bg-gray-500 dark:bg-gray-300'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setInviteSelectionModalOpen(false)}
                className="btn btn-secondary flex-1"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={closeInviteSelectionModal}
                className="btn btn-primary flex-1"
                disabled={eventData.invited_user_ids.length === 0}
              >
                Übernehmen
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
