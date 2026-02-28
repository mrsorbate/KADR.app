import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, Settings, SlidersHorizontal } from 'lucide-react';
import { teamsAPI } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../lib/useToast';
import { resolveAssetUrl } from '../lib/utils';

export default function TeamSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const teamId = parseInt(id || '', 10);
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fussballDeId, setFussballDeId] = useState('');
  const [fussballDeTeamName, setFussballDeTeamName] = useState('');
  const [showDeleteImportedGamesConfirm, setShowDeleteImportedGamesConfirm] = useState(false);
  const [defaultResponse, setDefaultResponse] = useState<'pending' | 'accepted' | 'tentative' | 'declined'>('pending');
  const [defaultRsvpDeadlineHoursTraining, setDefaultRsvpDeadlineHoursTraining] = useState('');
  const [defaultRsvpDeadlineDaysMatch, setDefaultRsvpDeadlineDaysMatch] = useState('');
  const [defaultRsvpDeadlineHoursOther, setDefaultRsvpDeadlineHoursOther] = useState('');
  const [defaultArrivalMinutesTraining, setDefaultArrivalMinutesTraining] = useState('');
  const [defaultArrivalMinutesMatch, setDefaultArrivalMinutesMatch] = useState('');

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['team-settings', teamId],
    queryFn: async () => {
      const response = await teamsAPI.getSettings(teamId);
      return response.data;
    },
    enabled: Number.isFinite(teamId),
    retry: false,
  });

  const { data: team } = useQuery({
    queryKey: ['team', teamId],
    queryFn: async () => {
      const response = await teamsAPI.getById(teamId);
      return response.data;
    },
    enabled: Number.isFinite(teamId),
  });

  useEffect(() => {
    if (!settings) return;
    setFussballDeId(settings.fussballde_id || '');
    setFussballDeTeamName(settings.fussballde_team_name || '');
    setDefaultResponse((settings.default_response || 'pending') as 'pending' | 'accepted' | 'tentative' | 'declined');
    const legacyDefault =
      settings.default_rsvp_deadline_hours === null || settings.default_rsvp_deadline_hours === undefined
        ? null
        : String(settings.default_rsvp_deadline_hours);
    setDefaultRsvpDeadlineHoursTraining(
      settings.default_rsvp_deadline_hours_training === null || settings.default_rsvp_deadline_hours_training === undefined
        ? (legacyDefault ?? '')
        : String(settings.default_rsvp_deadline_hours_training)
    );
    setDefaultRsvpDeadlineDaysMatch(
      settings.default_rsvp_deadline_hours_match === null || settings.default_rsvp_deadline_hours_match === undefined
        ? (legacyDefault ?? '')
        : String(Math.max(0, Math.round(Number(settings.default_rsvp_deadline_hours_match) / 24)))
    );
    setDefaultRsvpDeadlineHoursOther(
      settings.default_rsvp_deadline_hours_other === null || settings.default_rsvp_deadline_hours_other === undefined
        ? (legacyDefault ?? '')
        : String(settings.default_rsvp_deadline_hours_other)
    );
    setDefaultArrivalMinutesTraining(
      settings.default_arrival_minutes_training === null || settings.default_arrival_minutes_training === undefined
        ? (
          settings.default_arrival_minutes === null || settings.default_arrival_minutes === undefined
            ? ''
            : String(settings.default_arrival_minutes)
        )
        : String(settings.default_arrival_minutes_training)
    );
    setDefaultArrivalMinutesMatch(
      settings.default_arrival_minutes_match === null || settings.default_arrival_minutes_match === undefined
        ? ''
        : String(settings.default_arrival_minutes_match)
    );
  }, [settings]);

  const invalidateSettingsQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['team', teamId] });
    queryClient.invalidateQueries({ queryKey: ['team-settings', teamId] });
    queryClient.invalidateQueries({ queryKey: ['team-external-table', teamId] });
  };

  const updateApiSettingsMutation = useMutation({
    mutationFn: (payload: {
      fussballde_id?: string;
      fussballde_team_name?: string;
      default_response?: 'pending' | 'accepted' | 'tentative' | 'declined';
      default_rsvp_deadline_hours?: number | null;
      default_arrival_minutes?: number | null;
      default_arrival_minutes_training?: number | null;
      default_arrival_minutes_match?: number | null;
      default_arrival_minutes_other?: number | null;
    }) => teamsAPI.updateSettings(teamId, payload),
    onSuccess: () => {
      invalidateSettingsQueries();
      showToast('API-Einstellungen gespeichert', 'success');
    },
    onError: (mutationError: any) => {
      showToast(mutationError?.response?.data?.error || 'Fehler beim Speichern', 'error');
    },
  });

  const importNextGamesMutation = useMutation({
    mutationFn: async () => {
      const response = await teamsAPI.importNextGames(teamId, 8);
      return response.data;
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['events', teamId] });
      queryClient.invalidateQueries({ queryKey: ['all-events'] });
      const imported = Number(result?.imported || 0);
      const updated = Number(result?.updated || 0);
      const skipped = Number(result?.skipped || 0);
      showToast(`Nächste Spiele importiert: ${imported}, aktualisiert: ${updated}, übersprungen: ${skipped}`, 'success');
    },
    onError: (mutationError: any) => {
      showToast(mutationError?.response?.data?.error || 'Fehler beim Import der nächsten Spiele', 'error');
    },
  });

  const deleteImportedGamesMutation = useMutation({
    mutationFn: async () => {
      const response = await teamsAPI.deleteImportedGames(teamId);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', teamId] });
      queryClient.invalidateQueries({ queryKey: ['all-events'] });
      setShowDeleteImportedGamesConfirm(false);
      showToast('Importierte Spiele gelöscht', 'success');
    },
    onError: (mutationError: any) => {
      showToast(mutationError?.response?.data?.error || 'Fehler beim Löschen', 'error');
    },
  });

  const updateDefaultSettingsMutation = useMutation({
    mutationFn: (payload: {
      default_response?: 'pending' | 'accepted' | 'tentative' | 'declined';
      default_rsvp_deadline_hours?: number | null;
      default_rsvp_deadline_hours_training?: number | null;
      default_rsvp_deadline_hours_match?: number | null;
      default_rsvp_deadline_hours_other?: number | null;
      default_arrival_minutes?: number | null;
      default_arrival_minutes_training?: number | null;
      default_arrival_minutes_match?: number | null;
      default_arrival_minutes_other?: number | null;
    }) => teamsAPI.updateSettings(teamId, payload),
    onSuccess: () => {
      invalidateSettingsQueries();
      showToast('Standard-Einstellungen gespeichert', 'success');
    },
    onError: (mutationError: any) => {
      showToast(mutationError?.response?.data?.error || 'Fehler beim Speichern', 'error');
    },
  });

  const uploadTeamPictureMutation = useMutation({
    mutationFn: (file: File) => teamsAPI.uploadTeamPicture(teamId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      showToast('Mannschaftsbild erfolgreich gespeichert', 'success');
    },
    onError: (mutationError: any) => {
      const status = mutationError?.response?.status;
      if (status === 413) {
        showToast('Bild ist zu groß. Bitte maximal 5MB verwenden.', 'warning');
        return;
      }
      showToast(mutationError?.response?.data?.error || 'Fehler beim Speichern des Mannschaftsbilds', 'error');
    },
  });

  const deleteTeamPictureMutation = useMutation({
    mutationFn: () => teamsAPI.deleteTeamPicture(teamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      showToast('Mannschaftsbild erfolgreich gelöscht', 'success');
    },
    onError: (mutationError: any) => {
      showToast(mutationError?.response?.data?.error || 'Fehler beim Löschen des Mannschaftsbilds', 'error');
    },
  });

  const normalizeFussballDeId = (input: string): string => input.trim().toUpperCase();

  const extractFussballDeId = (input: string): string => {
    const value = input.trim();
    if (!value) return '';

    if (!/^https?:\/\//i.test(value)) {
      return normalizeFussballDeId(value);
    }

    try {
      const url = new URL(value);
      const pathParts = url.pathname.split('/').filter(Boolean);
      const candidate = [...pathParts]
        .reverse()
        .find((segment) => /^[A-Z0-9]{16,}$/i.test(segment));

      return candidate ? normalizeFussballDeId(candidate) : '';
    } catch {
      return '';
    }
  };

  const saveApiSettings = () => {
    const normalizedFussballId = normalizeFussballDeId(fussballDeId);
    if (normalizedFussballId && !/^[A-Z0-9]{16,40}$/.test(normalizedFussballId)) {
      showToast('Ungültiges fussball.de ID-Format', 'warning');
      return;
    }

    updateApiSettingsMutation.mutate({
      fussballde_id: normalizedFussballId || undefined,
      fussballde_team_name: fussballDeTeamName.trim() || undefined,
    });
  };

  const saveDefaultSettings = () => {
    const parseArrivalMinutes = (value: string, label: string): number | null | 'invalid' => {
      if (value.trim() === '') {
        return null;
      }
      const parsed = parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 240) {
        showToast(`${label} muss zwischen 0 und 240 Minuten liegen`, 'warning');
        return 'invalid';
      }
      return parsed;
    };

    const parsedArrivalMinutesTraining = parseArrivalMinutes(defaultArrivalMinutesTraining, 'Standard-Treffpunkt Training');
    if (parsedArrivalMinutesTraining === 'invalid') return;

    const parsedArrivalMinutesMatch = parseArrivalMinutes(defaultArrivalMinutesMatch, 'Standard-Treffpunkt Spiel');
    if (parsedArrivalMinutesMatch === 'invalid') return;

    const parseCategoryRsvpHours = (value: string, label: string): number | null | 'invalid' => {
      if (value.trim() === '') {
        return null;
      }
      const parsed = parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 168) {
        showToast(`${label} muss zwischen 0 und 168 Stunden liegen`, 'warning');
        return 'invalid';
      }
      return parsed;
    };

    const parsedRsvpDeadlineHoursTraining = parseCategoryRsvpHours(defaultRsvpDeadlineHoursTraining, 'Standard-Rückmeldefrist Training');
    if (parsedRsvpDeadlineHoursTraining === 'invalid') return;

    let parsedRsvpDeadlineHoursMatch: number | null = null;
    if (defaultRsvpDeadlineDaysMatch.trim() !== '') {
      const parsedDays = parseInt(defaultRsvpDeadlineDaysMatch, 10);
      if (!Number.isFinite(parsedDays) || parsedDays < 0 || parsedDays > 7) {
        showToast('Standard-Rückmeldefrist Spiel muss zwischen 0 und 7 Tagen liegen', 'warning');
        return;
      }
      parsedRsvpDeadlineHoursMatch = parsedDays * 24;
    }

    const parsedRsvpDeadlineHoursOther = parseCategoryRsvpHours(defaultRsvpDeadlineHoursOther, 'Standard-Rückmeldefrist Sonstiges');
    if (parsedRsvpDeadlineHoursOther === 'invalid') return;

    updateDefaultSettingsMutation.mutate({
      default_response: defaultResponse,
      default_rsvp_deadline_hours: parsedRsvpDeadlineHoursTraining,
      default_rsvp_deadline_hours_training: parsedRsvpDeadlineHoursTraining,
      default_rsvp_deadline_hours_match: parsedRsvpDeadlineHoursMatch,
      default_rsvp_deadline_hours_other: parsedRsvpDeadlineHoursOther,
      default_arrival_minutes: parsedArrivalMinutesTraining,
      default_arrival_minutes_training: parsedArrivalMinutesTraining,
      default_arrival_minutes_match: parsedArrivalMinutesMatch,
      default_arrival_minutes_other: parsedArrivalMinutesTraining,
    });
  };

  const stepDefaultArrivalMinutes = (field: 'training' | 'match', delta: number) => {
    const currentValue = field === 'training' ? defaultArrivalMinutesTraining : defaultArrivalMinutesMatch;
    const current = parseInt(currentValue, 10);
    const baseValue = Number.isFinite(current) ? current : 0;
    const nextValue = Math.min(240, Math.max(0, baseValue + delta));
    if (field === 'training') {
      setDefaultArrivalMinutesTraining(String(nextValue));
      return;
    }
    setDefaultArrivalMinutesMatch(String(nextValue));
  };

  const stepCategoryRsvpDeadlineHours = (field: 'training' | 'other', delta: number) => {
    const currentValue =
      field === 'training'
        ? defaultRsvpDeadlineHoursTraining
        : defaultRsvpDeadlineHoursOther;
    const current = parseInt(currentValue, 10);
    const baseValue = Number.isFinite(current) ? current : 0;
    const nextValue = Math.min(168, Math.max(0, baseValue + delta));
    if (field === 'training') {
      setDefaultRsvpDeadlineHoursTraining(String(nextValue));
      return;
    }
    setDefaultRsvpDeadlineHoursOther(String(nextValue));
  };

  const stepMatchRsvpDeadlineDays = (delta: number) => {
    const current = parseInt(defaultRsvpDeadlineDaysMatch, 10);
    const baseValue = Number.isFinite(current) ? current : 0;
    const nextValue = Math.min(7, Math.max(0, baseValue + delta));
    setDefaultRsvpDeadlineDaysMatch(String(nextValue));
  };

  const handleDefaultNumberWheel = (event: React.WheelEvent<HTMLInputElement>, field: 'rsvp-training' | 'rsvp-match-days' | 'rsvp-other' | 'arrival-training' | 'arrival-match') => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 1 : -1;
    if (field === 'rsvp-training') {
      stepCategoryRsvpDeadlineHours('training', delta);
      return;
    }
    if (field === 'rsvp-match-days') {
      stepMatchRsvpDeadlineDays(delta);
      return;
    }
    if (field === 'rsvp-other') {
      stepCategoryRsvpDeadlineHours('other', delta);
      return;
    }
    if (field === 'arrival-training') {
      stepDefaultArrivalMinutes('training', delta * 5);
      return;
    }
    stepDefaultArrivalMinutes('match', delta * 5);
  };

  const handleTeamPictureSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      event.target.value = '';
      return;
    }

    if (!file.type.match(/^image\/(jpeg|jpg|png|gif|webp)$/)) {
      showToast('Nur Bilddateien (JPEG, PNG, GIF, WEBP) sind erlaubt', 'warning');
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Die Datei ist zu groß. Maximale Größe: 5MB', 'warning');
      event.target.value = '';
      return;
    }

    uploadTeamPictureMutation.mutate(file);
    event.target.value = '';
  };

  const teamPictureUrl = resolveAssetUrl(team?.team_picture);

  if (user?.role !== 'trainer') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
        <Link to={`/teams/${teamId}`} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white break-words">Team-Einstellungen</h1>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1">Standardwerte und fussball.de Verknüpfung verwalten</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-500 dark:text-gray-400 py-2">Lädt Einstellungen...</div>
      ) : error ? (
        <div className="text-sm text-red-600 dark:text-red-400 py-2">{(error as any)?.response?.data?.error || 'Einstellungen konnten nicht geladen werden'}</div>
      ) : (
        <>
          <div className="card space-y-4">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary-600" />
              Mannschaftsbild
            </h2>

            {teamPictureUrl ? (
              <img
                src={teamPictureUrl}
                alt={team?.name || 'Mannschaftsbild'}
                className="w-full max-h-72 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
              />
            ) : (
              <div className="w-full h-40 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                Noch kein Mannschaftsbild vorhanden
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleTeamPictureSelect}
                title="Mannschaftsbild auswählen"
                aria-label="Mannschaftsbild auswählen"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadTeamPictureMutation.isPending || deleteTeamPictureMutation.isPending}
                className="btn btn-primary w-full sm:w-auto disabled:opacity-50"
              >
                {uploadTeamPictureMutation.isPending ? 'Speichert...' : teamPictureUrl ? 'Mannschaftsbild ändern' : 'Mannschaftsbild hochladen'}
              </button>
              {teamPictureUrl && (
                <button
                  type="button"
                  onClick={() => deleteTeamPictureMutation.mutate()}
                  disabled={uploadTeamPictureMutation.isPending || deleteTeamPictureMutation.isPending}
                  className="btn btn-secondary w-full sm:w-auto disabled:opacity-50"
                >
                  {deleteTeamPictureMutation.isPending ? 'Löscht...' : 'Mannschaftsbild löschen'}
                </button>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">JPEG, PNG, GIF oder WEBP (max. 5MB)</p>
            </div>
          </div>

          <div className="card space-y-4">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary-600" />
              API-Einstellungen
            </h2>
            <div>
              <label htmlFor="fussballde-id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                fussball.de ID
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="fussballde-id"
                  type="text"
                  value={fussballDeId}
                  onChange={(e) => setFussballDeId(normalizeFussballDeId(e.target.value))}
                  className="input w-full"
                  placeholder="ID oder vollständige fussball.de URL"
                />
                <button
                  type="button"
                  onClick={() => {
                    const extracted = extractFussballDeId(fussballDeId);
                    if (!extracted) {
                      showToast('Keine gültige fussball.de ID in der Eingabe gefunden', 'warning');
                      return;
                    }
                    setFussballDeId(extracted);
                    showToast('fussball.de ID aus URL übernommen', 'info');
                  }}
                  className="btn btn-secondary w-full sm:w-auto whitespace-nowrap"
                >
                  Aus URL übernehmen
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Beispiel: 011MI8V6UC000000VTVG0001VTR8C1K7</p>
            </div>

            <div>
              <label htmlFor="fussballde-team-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                fussball.de Team-Name
              </label>
              <input
                id="fussballde-team-name"
                type="text"
                value={fussballDeTeamName}
                onChange={(e) => setFussballDeTeamName(e.target.value)}
                className="input w-full"
                placeholder="z.B. FC Bayern München"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Der exakte Team-Name von fussball.de für die automatische Heimspiel-Erkennung</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={saveApiSettings}
                disabled={updateApiSettingsMutation.isPending}
                className="btn btn-primary w-full disabled:opacity-50"
              >
                {updateApiSettingsMutation.isPending ? 'Speichert...' : 'API speichern'}
              </button>

              <button
                type="button"
                onClick={() => importNextGamesMutation.mutate()}
                disabled={importNextGamesMutation.isPending || !fussballDeId.trim()}
                className="btn btn-secondary w-full disabled:opacity-50"
              >
                {importNextGamesMutation.isPending ? 'Import läuft...' : 'Spiele importieren'}
              </button>

              <button
                type="button"
                onClick={() => setShowDeleteImportedGamesConfirm(true)}
                disabled={deleteImportedGamesMutation.isPending}
                className="btn w-full bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:opacity-50"
              >
                {deleteImportedGamesMutation.isPending ? 'Löscht...' : 'Importierte Spiele löschen'}
              </button>
            </div>

            {showDeleteImportedGamesConfirm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Importierte Spiele wirklich löschen?</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    Alle von fussball.de importierten Spiele werden gelöscht. Du kannst sie anschließend neu importieren.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowDeleteImportedGamesConfirm(false)}
                      className="btn btn-secondary flex-1"
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={() => deleteImportedGamesMutation.mutate()}
                      disabled={deleteImportedGamesMutation.isPending}
                      className="btn btn-danger flex-1 disabled:opacity-50"
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="card space-y-4">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-primary-600" />
              Standard-Einstellungen
            </h2>
            <div>
              <label htmlFor="default-response" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Standard-Rückmeldung für neue Termine
              </label>
              <div className="mt-1 grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-label="Standard-Rückmeldung auswählen">
                {[
                  { value: 'pending', label: 'Offen' },
                  { value: 'accepted', label: 'Zugesagt' },
                  { value: 'tentative', label: 'Vielleicht' },
                  { value: 'declined', label: 'Abgesagt' },
                ].map((option) => {
                  const isActive = defaultResponse === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setDefaultResponse(option.value as 'pending' | 'accepted' | 'tentative' | 'declined')}
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

            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Standard-Rückmeldefrist je Kategorie
              </label>

              <div>
                <label htmlFor="default-rsvp-deadline-hours-training" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Training</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => stepCategoryRsvpDeadlineHours('training', -1)}
                    className="btn btn-secondary px-3"
                    aria-label="Standard-Rückmeldefrist Training verringern"
                  >
                    −
                  </button>
                  <input
                    id="default-rsvp-deadline-hours-training"
                    type="number"
                    min={0}
                    max={168}
                    step={1}
                    value={defaultRsvpDeadlineHoursTraining}
                    onChange={(e) => setDefaultRsvpDeadlineHoursTraining(e.target.value)}
                    onWheel={(e) => handleDefaultNumberWheel(e, 'rsvp-training')}
                    className="input w-full text-center"
                    placeholder="z. B. 3"
                  />
                  <button
                    type="button"
                    onClick={() => stepCategoryRsvpDeadlineHours('training', 1)}
                    className="btn btn-secondary px-3"
                    aria-label="Standard-Rückmeldefrist Training erhöhen"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="default-rsvp-deadline-days-match" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Spiel (Tage vor Termin)</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => stepMatchRsvpDeadlineDays(-1)}
                    className="btn btn-secondary px-3"
                    aria-label="Standard-Rückmeldefrist Spiel verringern"
                  >
                    −
                  </button>
                  <input
                    id="default-rsvp-deadline-days-match"
                    type="number"
                    min={0}
                    max={7}
                    step={1}
                    value={defaultRsvpDeadlineDaysMatch}
                    onChange={(e) => setDefaultRsvpDeadlineDaysMatch(e.target.value)}
                    onWheel={(e) => handleDefaultNumberWheel(e, 'rsvp-match-days')}
                    className="input w-full text-center"
                    placeholder="z. B. 3"
                  />
                  <button
                    type="button"
                    onClick={() => stepMatchRsvpDeadlineDays(1)}
                    className="btn btn-secondary px-3"
                    aria-label="Standard-Rückmeldefrist Spiel erhöhen"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="default-rsvp-deadline-hours-other" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Sonstiges</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => stepCategoryRsvpDeadlineHours('other', -1)}
                    className="btn btn-secondary px-3"
                    aria-label="Standard-Rückmeldefrist Sonstiges verringern"
                  >
                    −
                  </button>
                  <input
                    id="default-rsvp-deadline-hours-other"
                    type="number"
                    min={0}
                    max={168}
                    step={1}
                    value={defaultRsvpDeadlineHoursOther}
                    onChange={(e) => setDefaultRsvpDeadlineHoursOther(e.target.value)}
                    onWheel={(e) => handleDefaultNumberWheel(e, 'rsvp-other')}
                    className="input w-full text-center"
                    placeholder="z. B. 24"
                  />
                  <button
                    type="button"
                    onClick={() => stepCategoryRsvpDeadlineHours('other', 1)}
                    className="btn btn-secondary px-3"
                    aria-label="Standard-Rückmeldefrist Sonstiges erhöhen"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Standard Treffpunkt Minuten vor Beginn
              </label>

              <div>
                <label htmlFor="default-arrival-minutes-training" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Training</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => stepDefaultArrivalMinutes('training', -5)}
                    className="btn btn-secondary px-3"
                    aria-label="Standard-Treffpunkt Minuten Training verringern"
                  >
                    −
                  </button>
                  <input
                    id="default-arrival-minutes-training"
                    type="number"
                    min={0}
                    max={240}
                    step={5}
                    value={defaultArrivalMinutesTraining}
                    onChange={(e) => setDefaultArrivalMinutesTraining(e.target.value)}
                    onWheel={(e) => handleDefaultNumberWheel(e, 'arrival-training')}
                    className="input w-full text-center"
                    placeholder="z. B. 30"
                  />
                  <button
                    type="button"
                    onClick={() => stepDefaultArrivalMinutes('training', 5)}
                    className="btn btn-secondary px-3"
                    aria-label="Standard-Treffpunkt Minuten Training erhöhen"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="default-arrival-minutes-match" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Spiel</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => stepDefaultArrivalMinutes('match', -5)}
                    className="btn btn-secondary px-3"
                    aria-label="Standard-Treffpunkt Minuten Spiel verringern"
                  >
                    −
                  </button>
                  <input
                    id="default-arrival-minutes-match"
                    type="number"
                    min={0}
                    max={240}
                    step={5}
                    value={defaultArrivalMinutesMatch}
                    onChange={(e) => setDefaultArrivalMinutesMatch(e.target.value)}
                    onWheel={(e) => handleDefaultNumberWheel(e, 'arrival-match')}
                    className="input w-full text-center"
                    placeholder="z. B. 45"
                  />
                  <button
                    type="button"
                    onClick={() => stepDefaultArrivalMinutes('match', 5)}
                    className="btn btn-secondary px-3"
                    aria-label="Standard-Treffpunkt Minuten Spiel erhöhen"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={saveDefaultSettings}
              disabled={updateDefaultSettingsMutation.isPending}
              className="btn btn-primary w-full sm:w-auto disabled:opacity-50"
            >
              {updateDefaultSettingsMutation.isPending ? 'Speichert...' : 'Standards speichern'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
