import { api } from './api';

/**
 * Endereços de entrega do usuário — read-only no admin.
 * Reflete o que o usuário gerencia em Loja Fanverse / Meus dados.
 * Backend: GET /api/admin/users/:id/addresses.
 */
export interface UserAddress {
  id: string;
  recipient: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
}

export const addressService = {
  listForUser: (userId: string) =>
    api.get<{ addresses: UserAddress[] }>(`/api/admin/users/${userId}/addresses`),
};
