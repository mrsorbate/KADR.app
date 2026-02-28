import { useEffect, useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { profileAPI } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { User, Lock, Camera, Trash2, Check, AlertCircle } from 'lucide-react';
import { useToast } from '../lib/useToast';
import { resolveAssetUrl } from '../lib/utils';

export default function SettingsPage() {
  const { user: authUser } = useAuthStore();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDeletePictureConfirmModal, setShowDeletePictureConfirmModal] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const response = await profileAPI.getProfile();
      return response.data;
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      profileAPI.updatePassword(data),
    onSuccess: () => {
      setPasswordMessage({ type: 'success', text: 'Passwort erfolgreich geändert!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordMessage(null), 5000);
    },
    onError: (error: any) => {
      setPasswordMessage({
        type: 'error',
        text: error.response?.data?.error || 'Fehler beim Ändern des Passworts',
      });
      setTimeout(() => setPasswordMessage(null), 5000);
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: { phone_number?: string }) => profileAPI.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      showToast('Handynummer gespeichert', 'success');
    },
    onError: (error: any) => {
      showToast(error.response?.data?.error || 'Handynummer konnte nicht gespeichert werden', 'error');
    },
  });

  const uploadPictureMutation = useMutation({
    mutationFn: (file: File) => profileAPI.uploadPicture(file),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      showToast('Profilbild erfolgreich hochgeladen', 'success');
      // Update auth store with new profile picture
      if (authUser) {
        const updatedUser = { ...authUser, profile_picture: response.data.profile_picture };
        const token = localStorage.getItem('auth-token');
        if (token) {
          localStorage.setItem('auth-user', JSON.stringify(updatedUser));
          window.location.reload(); // Reload to update navigation
        }
      }
    },
    onError: () => {
      showToast('Profilbild konnte nicht hochgeladen werden', 'error');
    },
  });

  const deletePictureMutation = useMutation({
    mutationFn: () => profileAPI.deletePicture(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      showToast('Profilbild erfolgreich entfernt', 'success');
      // Update auth store - remove profile picture
      if (authUser) {
        const updatedUser = { ...authUser, profile_picture: undefined };
        const token = localStorage.getItem('auth-token');
        if (token) {
          localStorage.setItem('auth-user', JSON.stringify(updatedUser));
          window.location.reload(); // Reload to update navigation
        }
      }
    },
    onError: () => {
      showToast('Profilbild konnte nicht entfernt werden', 'error');
    },
  });

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Das neue Passwort muss mindestens 6 Zeichen lang sein' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Die Passwörter stimmen nicht überein' });
      return;
    }

    updatePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        showToast('Die Datei ist zu groß. Maximale Größe: 5MB', 'warning');
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        showToast('Bitte wähle eine Bilddatei aus', 'warning');
        return;
      }

      uploadPictureMutation.mutate(file);
    }
  };

  const handleDeletePicture = () => {
    setShowDeletePictureConfirmModal(true);
  };

  const confirmDeletePicture = () => {
    deletePictureMutation.mutate(undefined, {
      onSettled: () => {
        setShowDeletePictureConfirmModal(false);
      },
    });
  };

  const profilePictureUrl = resolveAssetUrl(profile?.profile_picture) || null;

  useEffect(() => {
    if (typeof profile?.phone_number === 'string') {
      setPhoneNumber(profile.phone_number);
    } else {
      setPhoneNumber('');
    }
  }, [profile?.phone_number]);

  const handlePhoneNumberSave = () => {
    updateProfileMutation.mutate({ phone_number: phoneNumber });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start sm:items-center gap-3">
        <User className="w-8 h-8 text-primary-600" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Einstellungen</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-1">Verwalte dein Profil und deine Einstellungen</p>
        </div>
      </div>

      {/* Profile Picture Section */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Camera className="w-6 h-6 mr-2 text-primary-600" />
          Profilbild
        </h2>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <div className="relative">
            {profilePictureUrl ? (
              <img
                src={profilePictureUrl}
                alt="Profilbild"
                className="w-32 h-32 rounded-full object-cover border-4 border-gray-600"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-gray-700 flex items-center justify-center border-4 border-gray-600">
                <User className="w-16 h-16 text-gray-300" />
              </div>
            )}
            {uploadPictureMutation.isPending && (
              <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              </div>
            )}
          </div>

          <div className="flex-1 space-y-3 w-full">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Erlaubte Formate: JPG, PNG, GIF, WebP (max. 5MB)
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                title="Profilbild auswählen"
                aria-label="Profilbild auswählen"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadPictureMutation.isPending}
                className="btn btn-primary w-full sm:w-auto"
              >
                {profilePictureUrl ? 'Bild ändern' : 'Bild hochladen'}
              </button>
              {profilePictureUrl && (
                <button
                  onClick={handleDeletePicture}
                  disabled={deletePictureMutation.isPending}
                  className="btn btn-secondary flex items-center justify-center space-x-2 w-full sm:w-auto"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Entfernen</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Profile Information */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <User className="w-6 h-6 mr-2 text-primary-600" />
          Profil-Informationen
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Benutzername
            </label>
            <div className="mt-1 text-gray-900 dark:text-white font-medium">{profile?.username || authUser?.username}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Name
            </label>
            <div className="mt-1 text-gray-900 dark:text-white font-medium">{profile?.name || authUser?.name}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              E-Mail
            </label>
            <div className="mt-1 text-gray-900 dark:text-white">{profile?.email || authUser?.email}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Rolle
            </label>
            <div className="mt-1">
              <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                authUser?.role === 'admin'
                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200'
                  : authUser?.role === 'trainer'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
                  : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
              }`}>
                {authUser?.role === 'admin' ? 'Administrator' : authUser?.role === 'trainer' ? 'Trainer' : 'Spieler'}
              </span>
            </div>
          </div>

          {authUser?.role === 'trainer' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Handynummer
              </label>
              <div className="mt-1 flex flex-col sm:flex-row gap-2 sm:gap-3">
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="input"
                  placeholder="z. B. +49 170 1234567"
                  maxLength={30}
                />
                <button
                  type="button"
                  onClick={handlePhoneNumberSave}
                  disabled={updateProfileMutation.isPending}
                  className="btn btn-primary w-full sm:w-auto"
                >
                  {updateProfileMutation.isPending ? 'Speichert...' : 'Speichern'}
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                Nur für Trainer-Info sichtbar in deinem Profil.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Change Password Section */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Lock className="w-6 h-6 mr-2 text-primary-600" />
          Passwort ändern
        </h2>

        {passwordMessage && (
          <div
            className={`mb-4 p-4 rounded-lg flex items-start space-x-3 ${
              passwordMessage.type === 'success'
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            {passwordMessage.type === 'success' ? (
              <Check className="w-5 h-5 text-green-600 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            )}
            <p
              className={`text-sm ${
                passwordMessage.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}
            >
              {passwordMessage.text}
            </p>
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Aktuelles Passwort
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input mt-1"
              placeholder="Aktuelles Passwort eingeben"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Neues Passwort
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input mt-1"
              placeholder="Mindestens 6 Zeichen"
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Neues Passwort bestätigen
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input mt-1"
              placeholder="Neues Passwort wiederholen"
            />
          </div>

          <button
            type="submit"
            disabled={updatePasswordMutation.isPending}
            className="btn btn-primary w-full sm:w-auto"
          >
            {updatePasswordMutation.isPending ? 'Wird gespeichert...' : 'Passwort ändern'}
          </button>
        </form>
      </div>

      {showDeletePictureConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Profilbild löschen?</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Möchtest du dein Profilbild wirklich dauerhaft entfernen?
            </p>

            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setShowDeletePictureConfirmModal(false)}
                disabled={deletePictureMutation.isPending}
                className="btn btn-secondary w-full sm:w-auto"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={confirmDeletePicture}
                disabled={deletePictureMutation.isPending}
                className="btn bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
              >
                {deletePictureMutation.isPending ? 'Löscht...' : 'Löschen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
