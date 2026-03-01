import { create } from 'zustand';

interface User {
  id: number;
  username: string;
  email: string;
  name: string;
  nickname?: string;
  role: string;
  profile_picture?: string;
  phone_number?: string;
  height_cm?: number;
  weight_kg?: number;
  clothing_size?: string;
  shoe_size?: string;
  jersey_number?: number;
  footedness?: string;
  position?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

// Load from localStorage on init
const loadAuthFromStorage = (): { token: string | null; user: User | null } => {
  try {
    const token = localStorage.getItem('auth-token');
    const userStr = localStorage.getItem('auth-user');
    const user = userStr ? JSON.parse(userStr) : null;
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
};

const initialState = loadAuthFromStorage();

export const useAuthStore = create<AuthState>((set) => ({
  token: initialState.token,
  user: initialState.user,
  setAuth: (token, user) => {
    localStorage.setItem('auth-token', token);
    localStorage.setItem('auth-user', JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem('auth-token');
    localStorage.removeItem('auth-user');
    set({ token: null, user: null });
  },
}));
