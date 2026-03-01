import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { eventsAPI, teamsAPI } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { ArrowLeft } from 'lucide-react';

export default function EventCreatePage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const teamIdFromParam = id ? parseInt(id) : null;
  const teamIdFromQuery = searchParams.get('teamId') ? parseInt(searchParams.get('teamId') as string, 10) : null;
  const initialTeamId = teamIdFromParam ?? teamIdFromQuery;

  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isTrainer = user?.role === 'trainer';

  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(initialTeamId);
  const [eventData, setEventData] = useState({
    title: '',
    type: 'training' as 'training' | 'match' | 'other',
    description: '',
    location: '',
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
    repeat_type: 'none' as 'none' | 'weekly' | 'custom',
    repeat_until: '',
    repeat_days: [] as number[],
  });

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

  const stepDurationMinutes = (delta: number) => {
    setEventData((prev) => {
      const current = parseInt(prev.duration_minutes, 10);
      const baseValue = Number.isFinite(current) ? current : 1;
      const nextValue = Math.max(1, baseValue + delta);
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

  const formatLocalDateTime = (date: Date) => {
    const pad = (value: number) => value.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const applyRsvpDeadlineOffsetHours = (hoursBefore: number) => {
    if (!eventData.start_time) {
      return;
    }
    const startDate = new Date(eventData.start_time);
    if (isNaN(startDate.getTime())) {
      return;
    }
    const normalizedHours = Math.max(0, Math.min(168, hoursBefore));
    const deadlineDate = new Date(startDate.getTime() - normalizedHours * 60 * 60 * 1000);
    setEventData((prev) => ({ ...prev, rsvp_deadline: formatLocalDateTime(deadlineDate) }));
  };

  const getCurrentRsvpDeadlineOffsetHours = (): string => {
    if (!eventData.start_time || !eventData.rsvp_deadline) {
      return '';
    }

    const startDate = new Date(eventData.start_time);
    const deadlineDate = new Date(eventData.rsvp_deadline);
    if (isNaN(startDate.getTime()) || isNaN(deadlineDate.getTime())) {
      return '';
    }

    const diffMs = startDate.getTime() - deadlineDate.getTime();
    if (diffMs < 0) {
      return '0';
    }

    const diffHours = Math.round(diffMs / (60 * 60 * 1000));
    return String(Math.min(168, Math.max(0, diffHours)));
  };

  const stepRsvpDeadlineHours = (delta: number) => {
    const current = parseInt(getCurrentRsvpDeadlineOffsetHours(), 10);
    const baseValue = Number.isFinite(current) ? current : 0;
    applyRsvpDeadlineOffsetHours(baseValue + delta);
  };

  const handleMinutesWheel = (event: React.WheelEvent<HTMLInputElement>, field: 'duration_minutes' | 'arrival_minutes') => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 5 : -5;
    if (field === 'duration_minutes') {
      stepDurationMinutes(delta);
      return;
    }
    stepArrivalMinutes(delta);
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

  const { data: teamsForCreate } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const response = await teamsAPI.getAll();
      return response.data;
    },
    enabled: isTrainer,
  });

  useEffect(() => {
    if (initialTeamId) {
      setSelectedTeamId(initialTeamId);
      return;
    }
    if (teamsForCreate?.length && selectedTeamId === null) {
      setSelectedTeamId(teamsForCreate[0].id);
    }
  }, [initialTeamId, teamsForCreate, selectedTeamId]);

  const effectiveTeamId = selectedTeamId;

  const { data: membersForCreate } = useQuery({
    queryKey: ['team-members', effectiveTeamId],
    queryFn: async () => {
      const response = await teamsAPI.getMembers(effectiveTeamId!);
      return response.data;
    },
    enabled: isTrainer && !!effectiveTeamId,
  });

  const { data: teamSettings } = useQuery({
    queryKey: ['team-settings', effectiveTeamId],
    queryFn: async () => {
      const response = await teamsAPI.getSettings(effectiveTeamId!);
      return response.data;
    },
    enabled: isTrainer && !!effectiveTeamId,
    retry: false,
  });

  const homeVenues = Array.isArray(teamSettings?.home_venues)
    ? teamSettings.home_venues.filter((venue: any) => venue && typeof venue === 'object' && String(venue.name || '').trim())
    : [];

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
    }));
  };

  useEffect(() => {
    if (!eventData.start_time || !eventData.duration_minutes) {
      return;
    }

    const startDate = new Date(eventData.start_time);
    if (isNaN(startDate.getTime())) {
      return;
    }

    const minutes = parseInt(eventData.duration_minutes, 10);
    if (Number.isNaN(minutes)) {
      return;
    }

    const endDate = new Date(startDate.getTime() + minutes * 60000);
    const pad = (value: number) => value.toString().padStart(2, '0');
    const formatted = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`;

    if (eventData.end_time !== formatted) {
      setEventData((prev) => ({ ...prev, end_time: formatted }));
    }
  }, [eventData.start_time, eventData.duration_minutes, eventData.end_time]);

  useEffect(() => {
    if (!eventData.start_time || eventData.rsvp_deadline) {
      return;
    }

    const deadlineHours = getCategoryDefaultRsvpHours(teamSettings, eventData.type);

    if (deadlineHours === null || !Number.isFinite(deadlineHours) || deadlineHours < 0) {
      return;
    }

    const startDate = new Date(eventData.start_time);
    if (isNaN(startDate.getTime())) {
      return;
    }

    const deadlineDate = new Date(startDate.getTime() - deadlineHours * 60 * 60 * 1000);
    const pad = (value: number) => value.toString().padStart(2, '0');
    const formatted = `${deadlineDate.getFullYear()}-${pad(deadlineDate.getMonth() + 1)}-${pad(deadlineDate.getDate())}T${pad(deadlineDate.getHours())}:${pad(deadlineDate.getMinutes())}`;

    setEventData((prev) => ({ ...prev, rsvp_deadline: formatted }));
  }, [
    eventData.start_time,
    eventData.rsvp_deadline,
    eventData.type,
    teamSettings?.default_rsvp_deadline_hours,
    teamSettings?.default_rsvp_deadline_hours_training,
    teamSettings?.default_rsvp_deadline_hours_match,
    teamSettings?.default_rsvp_deadline_hours_other,
  ]);

  useEffect(() => {
    if (!membersForCreate?.length) {
      return;
    }

    if (eventData.invited_user_ids.length === 0) {
      const allIds = membersForCreate.map((member: any) => member.id);
      setEventData((prev) => ({ ...prev, invited_user_ids: allIds }));
    }
  }, [membersForCreate, eventData.invited_user_ids.length]);

  useEffect(() => {
    if (!effectiveTeamId) {
      return;
    }
    setEventData((prev) => ({ ...prev, invited_user_ids: [], invite_all: true }));
  }, [effectiveTeamId]);

  useEffect(() => {
    if (!teamSettings) {
      return;
    }

    setEventData((prev) => {
      const next = { ...prev };
      const categoryDefaultArrival = getCategoryDefaultArrivalMinutes(teamSettings, next.type);
      if (!next.arrival_minutes && categoryDefaultArrival !== null) {
        next.arrival_minutes = String(categoryDefaultArrival);
      }
      return next;
    });
  }, [
    teamSettings?.default_arrival_minutes,
    teamSettings?.default_arrival_minutes_training,
    teamSettings?.default_arrival_minutes_match,
    teamSettings?.default_arrival_minutes_other,
    eventData.type,
  ]);

  const createEventMutation = useMutation({
    mutationFn: (data: any) => eventsAPI.create(data),
    onSuccess: () => {
      if (effectiveTeamId !== null) {
        queryClient.invalidateQueries({ queryKey: ['events', effectiveTeamId] });
      }
      queryClient.invalidateQueries({ queryKey: ['all-events'] });
      navigate(effectiveTeamId ? `/teams/${effectiveTeamId}/events?created=1` : '/events?created=1');
    },
  });

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();

    if (!effectiveTeamId) {
      return;
    }

    if (!eventData.end_time) {
      return;
    }

    const resolvedLocation = eventData.location_venue || eventData.location_zip_city || eventData.location;
    const dataToSend: any = {
      team_id: effectiveTeamId,
      title: eventData.title,
      type: eventData.type,
      description: eventData.description,
      location: resolvedLocation,
      location_venue: eventData.location_venue,
      location_street: eventData.location_street,
      location_zip_city: eventData.location_zip_city,
      pitch_type: eventData.pitch_type || undefined,
      meeting_point: eventData.meeting_point || undefined,
      arrival_minutes: eventData.arrival_minutes ? parseInt(eventData.arrival_minutes, 10) : undefined,
      start_time: eventData.start_time,
      end_time: eventData.end_time,
      duration_minutes: eventData.duration_minutes ? parseInt(eventData.duration_minutes, 10) : undefined,
      visibility_all: eventData.visibility_all,
      invite_all: eventData.invite_all,
      invited_user_ids: eventData.invited_user_ids,
    };

    if (eventData.rsvp_deadline) {
      dataToSend.rsvp_deadline = eventData.rsvp_deadline;
    }

    if (eventData.repeat_type !== 'none') {
      dataToSend.repeat_type = eventData.repeat_type;
      dataToSend.repeat_until = eventData.repeat_until;
      dataToSend.repeat_days = eventData.repeat_days;
    }

    createEventMutation.mutate(dataToSend);
  };

  if (!isTrainer) {
    return <Navigate to="/events" replace />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
          <Link to={effectiveTeamId ? `/teams/${effectiveTeamId}/events` : '/events'} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white break-words">Neuen Termin erstellen</h1>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleCreateEvent} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!initialTeamId && teamsForCreate?.length === 1 && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Team</label>
                <div className="mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-200">
                  {teamsForCreate[0].name}
                </div>
              </div>
            )}
            {!initialTeamId && (!teamsForCreate || teamsForCreate.length > 1) && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Team *</label>
                <select
                  value={selectedTeamId ?? ''}
                  onChange={(e) => setSelectedTeamId(parseInt(e.target.value, 10))}
                  className="input mt-1"
                  title="Team auswählen"
                  aria-label="Team auswählen"
                  required
                >
                  {teamsForCreate?.length ? (
                    teamsForCreate.map((team: any) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>
                      Keine Teams verfuegbar
                    </option>
                  )}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Kategorie *</label>
              <div className="mt-1 grid grid-cols-3 gap-2" role="group" aria-label="Kategorie auswählen">
                {categoryOptions.map((option) => {
                  const isActive = eventData.type === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setEventData({ ...eventData, type: option.value, rsvp_deadline: '' })}
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
                className="input mt-1"
                placeholder="z.B. Training, Heimspiel gegen..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Beginn *</label>
              <input
                type="datetime-local"
                required
                value={eventData.start_time}
                onChange={(e) => setEventData({ ...eventData, start_time: e.target.value })}
                title="Beginn auswählen"
                aria-label="Beginn auswählen"
                className="input mt-1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Dauer (Minuten) *</label>
              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => stepDurationMinutes(-5)}
                  className="btn btn-secondary px-3"
                  aria-label="Dauer verringern"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  step={5}
                  required
                  value={eventData.duration_minutes}
                  onChange={(e) => setEventData({ ...eventData, duration_minutes: e.target.value })}
                  onWheel={(e) => handleMinutesWheel(e, 'duration_minutes')}
                  className="input text-center"
                  placeholder="z.B. 90"
                />
                <button
                  type="button"
                  onClick={() => stepDurationMinutes(5)}
                  className="btn btn-secondary px-3"
                  aria-label="Dauer erhöhen"
                >
                  +
                </button>
              </div>
              {eventData.end_time && (
                <p className="text-xs text-gray-500 mt-1">Ende: {eventData.end_time.replace('T', ' ')}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Ort oder Spielstaette</label>
              {eventData.type === 'match' && homeVenues.length > 0 && (
                <select
                  defaultValue=""
                  onChange={(e) => applyHomeVenueByIndex(e.target.value)}
                  className="input mt-1"
                  title="Heimspiel-Platz auswählen"
                  aria-label="Heimspiel-Platz auswählen"
                >
                  <option value="">Heimspiel-Platz auswählen</option>
                  {homeVenues.map((venue: any, index: number) => (
                    <option key={`${venue.name}-${index}`} value={index}>
                      {venue.name}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                value={eventData.location_venue}
                onChange={(e) => setEventData({ ...eventData, location_venue: e.target.value })}
                className="input mt-1"
                placeholder="z.B. Sportzentrum Sued"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Strasse</label>
              <input
                type="text"
                value={eventData.location_street}
                onChange={(e) => setEventData({ ...eventData, location_street: e.target.value })}
                className="input mt-1"
                placeholder="z.B. Musterstrasse 12"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">PLZ Ort</label>
              <input
                type="text"
                value={eventData.location_zip_city}
                onChange={(e) => setEventData({ ...eventData, location_zip_city: e.target.value })}
                className="input mt-1"
                placeholder="z.B. 12345 Musterstadt"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Platzart</label>
              <div className="mt-1 flex flex-wrap gap-2" role="group" aria-label="Platzart auswählen">
                <button
                  type="button"
                  onClick={() => setEventData({ ...eventData, pitch_type: '' })}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    eventData.pitch_type === ''
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  Keine
                </button>
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

            <div>
              <label className="block text-sm font-medium text-gray-700">Treffpunkt</label>
              <input
                type="text"
                value={eventData.meeting_point}
                onChange={(e) => setEventData({ ...eventData, meeting_point: e.target.value })}
                className="input mt-1"
                placeholder="z.B. Parkplatz Haupttor"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">X Minuten vor dem Termin</label>
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
              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => stepArrivalMinutes(-5)}
                  className="btn btn-secondary px-3"
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
                  className="input text-center"
                  placeholder="z.B. 15"
                />
                <button
                  type="button"
                  onClick={() => stepArrivalMinutes(5)}
                  className="btn btn-secondary px-3"
                  aria-label="Ankunftsminuten erhöhen"
                >
                  +
                </button>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Optionale Beschreibung</label>
              <textarea
                value={eventData.description}
                onChange={(e) => setEventData({ ...eventData, description: e.target.value })}
                className="input mt-1"
                rows={3}
                placeholder="Optionale Details..."
              />
            </div>

            <div className="md:col-span-2 border-t pt-4">
              <h4 className="font-medium text-gray-900 mb-3">Einstellungen</h4>

              <div className="space-y-4">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={eventData.invite_all}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      if (checked && membersForCreate?.length) {
                        const allIds = membersForCreate.map((member: any) => member.id);
                        setEventData({ ...eventData, invite_all: checked, invited_user_ids: allIds });
                      } else {
                        setEventData({ ...eventData, invite_all: checked });
                      }
                    }}
                    className="h-4 w-4 text-primary-600"
                  />
                  <span className="text-sm text-gray-700">Alle Teammitglieder einladen</span>
                </label>

                {membersForCreate?.length ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Einladungen anpassen</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {membersForCreate.map((member: any) => {
                        const isChecked = eventData.invited_user_ids.includes(member.id);
                        return (
                          <label key={member.id} className="flex items-center space-x-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const nextIds = e.target.checked
                                  ? [...eventData.invited_user_ids, member.id]
                                  : eventData.invited_user_ids.filter((value) => value !== member.id);
                                setEventData({ ...eventData, invited_user_ids: nextIds });
                              }}
                              className="h-4 w-4 text-primary-600"
                            />
                            <span>{member.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div>
                  <label className="block text-sm font-medium text-gray-700">Rueckmeldefrist</label>
                  <div className="mt-1">
                    <label className="block text-xs text-gray-500 mb-1">Stunden vor Termin</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => stepRsvpDeadlineHours(-1)}
                        className="btn btn-secondary px-3"
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
                        onWheel={(e) => {
                          e.preventDefault();
                          const delta = e.deltaY < 0 ? 1 : -1;
                          stepRsvpDeadlineHours(delta);
                        }}
                        className="input text-center"
                        placeholder="z.B. 24"
                      />
                      <button
                        type="button"
                        onClick={() => stepRsvpDeadlineHours(1)}
                        className="btn btn-secondary px-3"
                        aria-label="Rückmeldefrist Stunden erhöhen"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <input
                    type="datetime-local"
                    value={eventData.rsvp_deadline}
                    onChange={(e) => setEventData({ ...eventData, rsvp_deadline: e.target.value })}
                    title="Rückmeldefrist auswählen"
                    aria-label="Rückmeldefrist auswählen"
                    className="input mt-2"
                  />
                </div>

                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={eventData.visibility_all}
                    onChange={(e) => setEventData({ ...eventData, visibility_all: e.target.checked })}
                    className="h-4 w-4 text-primary-600"
                  />
                  <span className="text-sm text-gray-700">Teilnehmerliste fuer alle sichtbar</span>
                </label>
              </div>
            </div>

            {/* Repeat Options */}
            <div className="md:col-span-2 border-t pt-4">
              <h4 className="font-medium text-gray-900 mb-3">Serientermin</h4>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Wiederholen</label>
                  <select
                    value={eventData.repeat_type}
                    onChange={(e) => setEventData({ ...eventData, repeat_type: e.target.value as any, repeat_days: [] })}
                    title="Wiederholung auswählen"
                    aria-label="Wiederholung auswählen"
                    className="input"
                  >
                    <option value="none">Nicht wiederholen</option>
                    <option value="weekly">Woechentlich</option>
                    <option value="custom">Bestimmte Wochentage</option>
                  </select>
                </div>

                {eventData.repeat_type !== 'none' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Wochentage auswaehlen</label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: 1, label: 'Mo' },
                          { value: 2, label: 'Di' },
                          { value: 3, label: 'Mi' },
                          { value: 4, label: 'Do' },
                          { value: 5, label: 'Fr' },
                          { value: 6, label: 'Sa' },
                          { value: 0, label: 'So' },
                        ].map((day) => (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => {
                              const newDays = eventData.repeat_days.includes(day.value)
                                ? eventData.repeat_days.filter((d) => d !== day.value)
                                : [...eventData.repeat_days, day.value];
                              setEventData({ ...eventData, repeat_days: newDays });
                            }}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                              eventData.repeat_days.includes(day.value)
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        {eventData.repeat_type === 'weekly'
                          ? 'Waehlte die Wochentage aus, an denen der Termin stattfindet'
                          : 'Waehlte alle gewuenschten Wochentage'}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Wiederholung endet am *</label>
                      <input
                        type="date"
                        required={eventData.repeat_type === 'weekly' || eventData.repeat_type === 'custom'}
                        value={eventData.repeat_until}
                        onChange={(e) => setEventData({ ...eventData, repeat_until: e.target.value })}
                        title="Wiederholungsende auswählen"
                        aria-label="Wiederholungsende auswählen"
                        className="input mt-1"
                      />
                      <p className="text-xs text-gray-500 mt-1">Bis zu welchem Datum sollen die Termine erstellt werden?</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              className="btn btn-primary w-full sm:w-auto"
              disabled={
                createEventMutation.isPending ||
                !effectiveTeamId ||
                eventData.invited_user_ids.length === 0
              }
            >
              {createEventMutation.isPending ? 'Erstellt...' : 'Termin erstellen'}
            </button>
            <button
              type="button"
              onClick={() => navigate(effectiveTeamId ? `/teams/${effectiveTeamId}/events` : '/events')}
              className="btn btn-secondary w-full sm:w-auto"
            >
              Abbrechen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
