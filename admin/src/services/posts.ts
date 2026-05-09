import { api } from './api';
import type { Post } from '@/types';

export const postsService = {
  list:   () => api.get<Post[]>('/posts'),
  get:    (id: string) => api.get<Post>(`/posts/${id}`),
  remove: (id: string) => api.delete<void>(`/posts/${id}`),
  approve: (id: string) => api.post<Post>(`/posts/${id}/approve`),
  feature: (id: string) => api.post<Post>(`/posts/${id}/feature`),
};
