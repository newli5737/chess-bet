import axios from 'axios';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';
export const SOCKET_PATH = '/game';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});
