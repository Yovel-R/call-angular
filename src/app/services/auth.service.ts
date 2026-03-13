import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface RegisterPayload {
  companyName: string;
  name: string;
  email: string;
  password: string;
  countryCode: string;
  mobile: string;
  companyAddress?: string;
  teamSize: string;
  industry: string;
  isTrial?: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ApiResponse {
  success: boolean;
  message: string;
  userId?: string;
  companyName?: string;
  companyCode?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    companyName: string;
    companyCode?: string;
    teamSize: string;
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private api: ApiService) {}

  register(payload: RegisterPayload): Observable<ApiResponse> {
    return this.api.post<ApiResponse>('/api/auth/register', payload);
  }

  login(payload: LoginPayload): Observable<ApiResponse> {
    return this.api.post<ApiResponse>('/api/auth/login', payload);
  }

  getCompanyProfile(companyCode: string): Observable<any> {
    return this.api.get(`/api/auth/company/${encodeURIComponent(companyCode)}`);
  }

  changePassword(companyCode: string, payload: any): Observable<any> {
    return this.api.put(`/api/auth/company/${encodeURIComponent(companyCode)}/password`, payload);
  }

  updateAddress(companyCode: string, companyAddress: string): Observable<any> {
    return this.api.put(`/api/auth/company/${encodeURIComponent(companyCode)}/address`, { companyAddress });
  }

  requestRm(companyCode: string): Observable<any> {
    return this.api.post(`/api/auth/company/${encodeURIComponent(companyCode)}/request-rm`, {});
  }

  assignRm(companyCode: string, rmData: any): Observable<any> {
    return this.api.put(`/api/auth/company/${encodeURIComponent(companyCode)}/assign-rm`, rmData);
  }

  updateCompanyTags(companyCode: string, tags: string[]): Observable<any> {
    return this.api.put(`/api/auth/company/${encodeURIComponent(companyCode)}/tags`, { tags });
  }

  updateTeamSize(companyCode: string, teamSize: string): Observable<any> {
    return this.api.put(`/api/auth/company/${encodeURIComponent(companyCode)}/team-size`, { teamSize });
  }
}
