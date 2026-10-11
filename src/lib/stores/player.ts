import { writable } from 'svelte/store';
import type { Song } from '../types';

export const currentSong = writable<Song | null>(null);
export const queue = writable<Song[]>([]);
export const history = writable<Song[]>([]);
export const isPlaying = writable<boolean>(false);
export const progress = writable<number>(0);
export const currentTime = writable<number>(0);
export const duration = writable<number>(0);
export const isLoading = writable<boolean>(false);
export const loadingStatus = writable<string>('');
export const volume = writable<number>(1);
export const showPlayer = writable<boolean>(false);
